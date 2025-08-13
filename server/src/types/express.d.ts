// src/types/express.d.ts
import { JwtPayload } from '../middleware/auth';
import { Server as SocketIOServer } from 'socket.io';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        email: string;
        name: string;
        isVerified: boolean;
        twoFactorEnabled: boolean;
        phone?: string;
        status?: string;
      };
      io?: SocketIOServer; // ✅ Add this for Socket.IO
    }
  }
}

export {};
