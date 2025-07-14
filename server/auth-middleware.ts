import { Request, Response, NextFunction } from 'express';
import { SimpleAuth } from './simple-auth';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authToken = req.cookies['auth-token'];
    
    if (!authToken) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const result = await SimpleAuth.verifyAuthToken(authToken);
    
    if (!result.success || !result.user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = result.user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authToken = req.cookies['auth-token'];
    
    if (authToken) {
      const result = await SimpleAuth.verifyAuthToken(authToken);
      
      if (result.success && result.user) {
        req.user = result.user;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without auth
  }
};