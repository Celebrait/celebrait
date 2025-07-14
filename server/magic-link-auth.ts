import crypto from 'crypto';
import { db } from './db';
import { magicLinks, users } from '@shared/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { sendEmail } from './email-service';

export class MagicLinkAuth {
  private static readonly EXPIRY_MINUTES = 15;

  /**
   * Generate and send magic link for user authentication
   */
  static async sendMagicLink(email: string, redirectUrl?: string): Promise<{
    success: boolean;
    message: string;
    token?: string;
  }> {
    try {
      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000);

      // Store magic link in database
      await db.insert(magicLinks).values({
        email,
        token,
        expiresAt,
      });

      // Create magic link URL using proper domain detection
      const baseUrl = process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'https://app.celebrait.co.za';
      
      const magicLinkUrl = `${baseUrl}/auth/verify?token=${token}${redirectUrl ? `&redirect=${encodeURIComponent(redirectUrl)}` : ''}`;

      // Send email
      const emailSent = await sendEmail({
        to: email,
        from: 'greetings@celebrait.co.za',
        subject: 'Sign in to Celebrait - Magic Link',
        html: this.generateMagicLinkEmail(magicLinkUrl, email),
      });

      if (emailSent) {
        return {
          success: true,
          message: 'Magic link sent successfully',
          token
        };
      } else {
        return {
          success: false,
          message: 'Failed to send magic link email'
        };
      }
    } catch (error) {
      console.error('Magic link generation error:', error);
      return {
        success: false,
        message: 'Failed to generate magic link'
      };
    }
  }

  /**
   * Verify magic link token and authenticate user
   */
  static async verifyMagicLink(token: string): Promise<{
    success: boolean;
    message: string;
    user?: any;
  }> {
    try {
      console.log('Verifying magic link token:', token);
      
      // Find unused, non-expired magic link
      const [magicLink] = await db
        .select()
        .from(magicLinks)
        .where(
          and(
            eq(magicLinks.token, token),
            gt(magicLinks.expiresAt, new Date()),
            isNull(magicLinks.usedAt)
          )
        );

      console.log('Magic link found:', magicLink);

      if (!magicLink) {
        // Check if token exists at all
        const [tokenExists] = await db
          .select()
          .from(magicLinks)
          .where(eq(magicLinks.token, token));
        
        console.log('Token exists in database:', tokenExists);
        
        return {
          success: false,
          message: 'Invalid or expired magic link'
        };
      }

      // Mark magic link as used
      await db
        .update(magicLinks)
        .set({ usedAt: new Date() })
        .where(eq(magicLinks.id, magicLink.id));

      // Find or create user
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, magicLink.email));

      if (!user) {
        // Create new user
        const [newUser] = await db
          .insert(users)
          .values({
            email: magicLink.email,
            username: magicLink.email.split('@')[0],
            firstName: null,
            lastName: null,
            isVerified: true,
          })
          .returning();
        
        user = newUser;
      } else {
        // Update existing user as verified
        await db
          .update(users)
          .set({ isVerified: true })
          .where(eq(users.id, user.id));
      }

      return {
        success: true,
        message: 'Successfully authenticated',
        user
      };
    } catch (error) {
      console.error('Magic link verification error:', error);
      return {
        success: false,
        message: 'Failed to verify magic link'
      };
    }
  }

  /**
   * Generate HTML email for magic link
   */
  private static generateMagicLinkEmail(magicLinkUrl: string, email: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Sign in to Celebrait</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to Celebrait</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your magic link is ready</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #333; margin-top: 0;">Sign in to your account</h2>
            <p style="color: #666; margin-bottom: 25px;">
              Click the button below to sign in to Celebrait. This link will expire in 15 minutes.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLinkUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        font-size: 16px; 
                        display: inline-block;">
                Sign in to Celebrait
              </a>
            </div>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Security note:</strong> This link is unique to ${email} and will expire in 15 minutes. Don't share it with anyone.
            </p>
          </div>
          
          <div style="text-align: center; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px;">
            <p>Need help? Contact us at <a href="mailto:support@celebrait.co.za">support@celebrait.co.za</a></p>
            <p style="margin-top: 15px;">© 2025 Celebrait. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }
}