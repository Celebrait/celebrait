import { storage } from './storage';
import { sendEmail } from './email-service';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'celebrait-jwt-secret-key';

export class SimpleAuth {
  /**
   * Send login link with JWT token
   */
  static async sendLoginLink(email: string, redirectUrl?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find or create user
      let user = await storage.getUserByEmail(email);
      if (!user) {
        // Extract name from email for new users
        const emailName = email.split('@')[0];
        const firstName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        
        user = await storage.createUser({
          email,
          firstName,
          lastName: '',
        });
      }

      // Create JWT token that expires in 15 minutes
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
        },
        JWT_SECRET
      );

      // Create login URL
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://your-domain.replit.dev'
        : 'http://localhost:5000';
      
      const loginUrl = `${baseUrl}/api/auth/login?token=${token}${redirectUrl ? `&redirect=${encodeURIComponent(redirectUrl)}` : ''}`;

      // Send email
      const emailParams = {
        to: email,
        from: 'greetings@celebrait.co.za',
        subject: 'Sign in to Celebrait',
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <h2 style="color: #7c3aed; text-align: center;">Sign in to Celebrait</h2>
            <p>Hello ${user.firstName},</p>
            <p>Click the button below to sign in to your Celebrait account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                Sign In to Celebrait
              </a>
            </div>
            <p style="font-size: 14px; color: #666;">This link will expire in 15 minutes.</p>
            <p style="font-size: 12px; color: #999;">If you didn't request this, please ignore this email.</p>
          </div>
        `
      };

      const emailSent = await sendEmail(emailParams);
      
      if (emailSent) {
        return { success: true, message: 'Login link sent successfully' };
      } else {
        return { success: false, message: 'Failed to send login link' };
      }
    } catch (error) {
      console.error('Error sending login link:', error);
      return { success: false, message: 'Failed to send login link' };
    }
  }

  /**
   * Verify JWT token and return user
   */
  static async verifyToken(token: string): Promise<{ success: boolean; user?: any; message: string }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      return { success: true, user, message: 'Token verified successfully' };
    } catch (error) {
      console.error('Token verification error:', error);
      return { success: false, message: 'Invalid or expired token' };
    }
  }

  /**
   * Create JWT token for authenticated user
   */
  static createAuthToken(user: any): string {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      JWT_SECRET
    );
  }

  /**
   * Verify auth token from request
   */
  static async verifyAuthToken(token: string): Promise<{ success: boolean; user?: any }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await storage.getUser(decoded.userId);
      
      if (!user) {
        return { success: false };
      }

      return { success: true, user };
    } catch (error) {
      return { success: false };
    }
  }
}