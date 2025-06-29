import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Express } from "express";
import { storage } from "./storage";

export function setupGoogleAuth(app: Express) {
  // Only set up Google auth if credentials are provided
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log("Google OAuth credentials not provided - SSO disabled");
    return;
  }

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
      
      if (!user) {
        // Create new user from Google profile
        user = await storage.createUser({
          email: profile.emails?.[0]?.value || '',
          username: profile.displayName || profile.emails?.[0]?.value || '',
        });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  // Google OAuth routes
  app.get("/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"]
  }));

  app.get("/auth/google/callback", 
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
      // Successful authentication
      const user = req.user as any;
      // Redirect back to the card generation with user info
      res.redirect(`/?sso=success&name=${encodeURIComponent(user.username)}&email=${encodeURIComponent(user.email)}`);
    }
  );

  // Get current user info (for frontend)
  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
}