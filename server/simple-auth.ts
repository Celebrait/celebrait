import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { sendEmail } from "./email-service";
import crypto from "crypto";

// Simple session configuration for email-based auth
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

// Generate a secure login token
function generateLoginToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Setup simple email-based authentication
export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Request login email
  app.post("/api/auth/request-login", async (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: "Valid email required" });
    }

    try {
      // Generate login token
      const loginToken = generateLoginToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store login token in database
      await storage.createLoginToken(email, loginToken, expiresAt);

      // Send login email
      const loginUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-login?token=${loginToken}`;
      
      await sendEmail({
        to: email,
        from: 'greetings@celebrait.co.za',
        subject: 'Sign in to Celebrait',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Sign in to Celebrait</h2>
            <p>Click the link below to sign in to your account:</p>
            <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(to right, #6366f1, #3b82f6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Sign In to Celebrait
            </a>
            <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        `
      });

      res.json({ success: true, message: "Login link sent to your email" });
    } catch (error) {
      console.error("Error sending login email:", error);
      res.status(500).json({ error: "Failed to send login email" });
    }
  });

  // Verify login token
  app.get("/api/auth/verify-login", async (req, res) => {
    const { token } = req.query;

    if (!token) {
      return res.redirect('/?error=invalid_token');
    }

    try {
      const loginAttempt = await storage.getLoginToken(token as string);
      
      if (!loginAttempt || loginAttempt.expiresAt < new Date()) {
        return res.redirect('/?error=expired_token');
      }

      // Create or get user
      let user = await storage.getUserByEmail(loginAttempt.email);
      if (!user) {
        user = await storage.upsertUser({
          id: crypto.randomUUID(),
          email: loginAttempt.email,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
        });
      }

      // Set session
      (req.session as any).user = user;
      
      // Clean up login token
      await storage.deleteLoginToken(token as string);

      res.redirect('/dashboard');
    } catch (error) {
      console.error("Error verifying login token:", error);
      res.redirect('/?error=login_failed');
    }
  });

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    const user = (req.session as any)?.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(user);
  });

  // Logout
  app.get("/api/auth/logout", (req, res) => {
    req.session?.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
      res.redirect('/');
    });
  });
}

// Auth middleware
export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.user = user;
  next();
};