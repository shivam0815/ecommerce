import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUserDocument } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set');
}

const getAuthorizedEmails = (): string[] => {
  const emails = process.env.AUTHORIZED_ADMIN_EMAILS || '';
  return emails
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0);
};

const isAuthorizedAdminEmail = (email: string): boolean => {
  const authorizedEmails = getAuthorizedEmails();
  const normalizedEmail = email.trim().toLowerCase();
  return authorizedEmails.includes(normalizedEmail);
};

export interface JwtPayload {
  id: string;
  role: string;
  email: string;
}

// ✅ Custom interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
    email: string;
    name: string;
    isVerified: boolean;
    twoFactorEnabled: boolean;
  };
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access token missing or malformed' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const user = await User.findById(decoded.id).select('-password') as IUserDocument;
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.'
      });
      return;
    }

    if (user.role === 'admin' && !isAuthorizedAdminEmail(user.email)) {
      res.status(403).json({
        success: false,
        message: 'Admin access has been revoked. Contact IT support.',
        code: 'ADMIN_ACCESS_REVOKED'
      });
      return;
    }

    // ✅ Set user with proper typing
    req.user = {
      id: user.id, // Using the virtual getter instead of _id
      role: user.role,
      email: user.email,
      name: user.name,
      isVerified: user.isVerified || false,
      twoFactorEnabled: user.twoFactorEnabled || false
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token has expired', code: 'TOKEN_EXPIRED' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
    } else {
      res.status(500).json({ success: false, message: 'Authentication failed', code: 'AUTH_ERROR' });
    }
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // ✅ Type assertion to ensure user exists
    const user = req.user as AuthenticatedRequest['user'];

    if (!user) {
      res.status(403).json({ success: false, message: 'Access denied: no user authenticated' });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: user.role
      });
      return;
    }

    next();
  };
};

export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user as AuthenticatedRequest['user'];

  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  if (!user.isVerified) {
    res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this feature',
      code: 'EMAIL_VERIFICATION_REQUIRED'
    });
    return;
  }

  next();
};

export const requireTwoFactor = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user as AuthenticatedRequest['user'];

  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  if (!user.twoFactorEnabled) {
    res.status(403).json({
      success: false,
      message: 'Two-factor authentication is required for this action',
      code: 'TWO_FACTOR_REQUIRED'
    });
    return;
  }

  next();
};

export const rateLimitSensitive = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  console.log(`🚦 Rate limit check for IP: ${clientIP}`);
  next();
};

export const auditLog = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthenticatedRequest['user'] | undefined;
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;

    console.log(`📝 AUDIT LOG [${timestamp}] - User: ${user?.id || 'anonymous'} (${user?.email || 'no-email'}) | Action: ${action} | IP: ${ip} | URL: ${req.originalUrl}`);
    next();
  };
};

export const validateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user as AuthenticatedRequest['user'] | undefined;

  if (!user) {
    next();
    return;
  }

  try {
    const currentUser = await User.findById(user.id) as IUserDocument | null;
    if (!currentUser || !currentUser.isActive) {
      res.status(401).json({
        success: false,
        message: 'Session invalid - please login again',
        code: 'SESSION_INVALID'
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Session validation failed' });
  }
};

// Grouped exports for convenience
export const adminOnly = [authenticate, authorize(['admin'])];
export const userOrAdmin = [authenticate, authorize(['user', 'admin'])];
export const verifiedUsersOnly = [authenticate, requireEmailVerification];
export const secureAdminOnly = [authenticate, authorize(['admin']), rateLimitSensitive, auditLog('admin-access')];
export const verifiedAdminOnly = [authenticate, authorize(['admin']), requireEmailVerification];
export const twoFactorAdminOnly = [authenticate, authorize(['admin']), requireTwoFactor];

export { isAuthorizedAdminEmail, getAuthorizedEmails };
