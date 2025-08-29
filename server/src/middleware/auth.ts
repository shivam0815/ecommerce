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
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
};

const isAuthorizedAdminEmail = (email: string): boolean => {
  const authorizedEmails = getAuthorizedEmails();
  const normalizedEmail = email.trim().toLowerCase();
  return authorizedEmails.includes(normalizedEmail);
};

export interface JwtPayload {
  id?: string;
  _id?: string;
  userId?: string;
  role?: string;
  email?: string;
  name?: string;
}

// ---- Helpers ---------------------------------------------------------------

/** Try to pull a JWT from Authorization, x-auth-token, or cookies */
function extractToken(req: Request): string | null {
  // 1) Authorization header
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string') {
    // Bearer <token> OR raw token (some older clients)
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
    if (parts.length === 1) {
      return parts[0].trim();
    }
  }

  // 2) x-auth-token
  const xAuth = req.headers['x-auth-token'];
  if (typeof xAuth === 'string' && xAuth.trim()) {
    return xAuth.trim();
  }

  // 3) cookies (if cookie-parser is installed)
  const anyReq = req as any;
  const c1 = anyReq?.cookies?.token;
  const c2 = anyReq?.cookies?.auth_token;
  if (typeof c1 === 'string' && c1.trim()) return c1.trim();
  if (typeof c2 === 'string' && c2.trim()) return c2.trim();

  return null;
}

/** Normalize possible id fields from JWT payload */
function normalizeUserId(payload: JwtPayload): string | null {
  return (payload.id || payload._id || payload.userId || null) ?? null;
}

// ---- Public types ----------------------------------------------------------

interface AuthenticatedUser {
  id: string;
  role: string;
  email: string;
  name: string;
  isVerified: boolean;
  twoFactorEnabled: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

// ---- Middlewares -----------------------------------------------------------

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Access token missing' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const id = normalizeUserId(decoded);
    if (!id) {
      res.status(401).json({ success: false, message: 'Invalid token payload' });
      return;
    }

    const user = (await User.findById(id).select('-password')) as IUserDocument | null;
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.',
      });
      return;
    }

    if (user.role === 'admin' && !isAuthorizedAdminEmail(user.email)) {
      res.status(403).json({
        success: false,
        message: 'Admin access has been revoked. Contact IT support.',
        code: 'ADMIN_ACCESS_REVOKED',
      });
      return;
    }

    req.user = {
      id: user.id, // virtual string getter
      role: user.role,
      email: user.email,
      name: user.name,
      isVerified: user.isVerified || false,
      twoFactorEnabled: user.twoFactorEnabled || false,
    };

    next();
  } catch (err: any) {
    // Keep messages stable for the client while giving yourself enough context in logs
    if (err instanceof jwt.TokenExpiredError) {
      console.warn('🔐 Token expired');
      res.status(401).json({ success: false, message: 'Token has expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      console.warn('🔐 Invalid token:', err.message);
      res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
      return;
    }
    console.error('🔐 Auth error:', err);
    res.status(500).json({ success: false, message: 'Authentication failed', code: 'AUTH_ERROR' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
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
        current: user.role,
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
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  if (!user.isVerified) {
    res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this feature',
      code: 'EMAIL_VERIFICATION_REQUIRED',
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
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  if (!user.twoFactorEnabled) {
    res.status(403).json({
      success: false,
      message: 'Two-factor authentication is required for this action',
      code: 'TWO_FACTOR_REQUIRED',
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
  const clientIP = req.ip || (req.connection as any)?.remoteAddress || 'unknown';
  console.log(`🚦 Rate limit check for IP: ${clientIP}`);
  next();
};

export const auditLog = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    const timestamp = new Date().toISOString();
    const ip = req.ip || (req.connection as any)?.remoteAddress || 'unknown';
    console.log(
      `📝 AUDIT LOG [${timestamp}] - User: ${user?.id || 'anonymous'} (${user?.email || 'no-email'}) | Action: ${action} | IP: ${ip} | URL: ${req.originalUrl}`
    );
    next();
  };
};

export const validateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user;
  if (!user) {
    next();
    return;
  }
  try {
    const currentUser = (await User.findById(user.id)) as IUserDocument | null;
    if (!currentUser || !currentUser.isActive) {
      res.status(401).json({
        success: false,
        message: 'Session invalid - please login again',
        code: 'SESSION_INVALID',
      });
      return;
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Session validation failed' });
  }
};



export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return next();

    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (!token) return next();

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const id = decoded?.id || decoded?._id || decoded?.userId;
    if (!id) return next();

    const user = await User.findById(id).select('-password');
    if (!user) return next();

    (req as any).user = {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      isVerified: user.isVerified || false,
      twoFactorEnabled: user.twoFactorEnabled || false,
    };
  } catch {
    // swallow errors for optional auth
  }
  next();
};


export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  // First run your normal authentication
  authenticate(req, res, (err?: any) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Now check role
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
    }

    next();
  });
};

// Grouped exports
export const adminOnly = [authenticate, authorize(['admin'])];
export const userOrAdmin = [authenticate, authorize(['user', 'admin'])];
export const verifiedUsersOnly = [authenticate, requireEmailVerification];
export const secureAdminOnly = [authenticate, authorize(['admin']), rateLimitSensitive, auditLog('admin-access')];
export const verifiedAdminOnly = [authenticate, authorize(['admin']), requireEmailVerification];
export const twoFactorAdminOnly = [authenticate, authorize(['admin']), requireTwoFactor];

export { isAuthorizedAdminEmail, getAuthorizedEmails }; 