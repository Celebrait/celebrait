import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request type to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
    interface Session {
      userId?: string;
      userEmail?: string;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Convert string userId to number for database query
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(numericUserId)) {
      return res.status(401).json({ message: 'Invalid user ID' });
    }
    
    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, numericUserId));

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('OptionalAuth: Session exists:', !!req.session);
    console.log('OptionalAuth: Session ID:', req.session?.id);
    console.log('OptionalAuth: User ID in session:', req.session?.userId);
    console.log('OptionalAuth: Full session data:', req.session);
    console.log('OptionalAuth: Cookie header:', req.headers.cookie);
    
    const userId = req.session?.userId;
    
    if (userId) {
      console.log('OptionalAuth: Looking up user with ID:', userId);
      // Convert string userId to number for database query
      const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
      if (isNaN(numericUserId)) {
        console.log('OptionalAuth: Invalid user ID:', userId);
        return next();
      }
      
      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, numericUserId));

      console.log('OptionalAuth: User found:', user);
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without auth
  }
};