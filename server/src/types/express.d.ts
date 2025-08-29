import { Server as SocketIOServer } from 'socket.io';

declare global {
  namespace Express {
    // define reusable type
    interface AuthenticatedUser {
      id: string;
      role: string;
      email: string;
      name: string;
      isVerified: boolean;
      twoFactorEnabled: boolean;
      phone?: string;
      status?: string;
    }

    interface Request {
      user?: AuthenticatedUser;
      io?: SocketIOServer;
    }
  }
}

export {};
