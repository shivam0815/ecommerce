// socket.ts
import type { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

type JoinPayload = { role?: 'admin' | 'user'; userId?: string };

export function initSocket(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        // allow same-origin and tools with no Origin (e.g., curl/healthchecks)
        if (!origin) return cb(null, true);
        if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },
    transports: ['websocket', 'polling'],
    allowEIO3: false,
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Optional: auth middleware (read JWT from cookie or handshake.auth)
  io.use(async (socket, next) => {
    try {
      // Example: const token = socket.handshake.auth?.token || parseCookie(socket.handshake.headers.cookie).access_token;
      // const user = verifyJwt(token); socket.data.user = user;
      return next();
    } catch (err) {
      return next(new Error('Unauthorized socket'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('🔌 socket connected:', socket.id);

    // Per-socket flags to make joins idempotent
    socket.data.joinedAdmin = false as boolean;
    socket.data.joinedUserId = null as string | null;

    socket.on('join', (payload: JoinPayload = {}) => {
      const { role, userId } = payload;

      // idempotent admin join
      if (role === 'admin' && !socket.data.joinedAdmin) {
        socket.join('admins');
        socket.data.joinedAdmin = true;
        console.log('👑 joined admins:', socket.id);
        io!.to(socket.id).emit('admin:joined', { id: socket.id }); // ack back (optional)
      }

      // idempotent user room join (switch if different user)
      if (userId && socket.data.joinedUserId !== userId) {
        if (socket.data.joinedUserId) {
          socket.leave(socket.data.joinedUserId);
        }
        socket.join(userId);
        socket.data.joinedUserId = userId;
        console.log('👤 joined user room:', userId, socket.id);
      }
    });

    // Legacy routes—now idempotent
    socket.on('join-admin', () => {
      if (!socket.data.joinedAdmin) {
        socket.join('admins');
        socket.data.joinedAdmin = true;
        console.log('👑 joined admins (legacy):', socket.id);
      }
    });

    socket.on('join-user', (payload: { userId?: string } | string) => {
      const userId = typeof payload === 'string' ? payload : payload?.userId;
      if (userId && socket.data.joinedUserId !== userId) {
        if (socket.data.joinedUserId) socket.leave(socket.data.joinedUserId);
        socket.join(userId);
        socket.data.joinedUserId = userId;
        console.log('👤 joined user room (legacy):', userId, socket.id);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 socket disconnected:', socket.id, reason);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized yet');
  return io;
}

/** Handy emitters (use these from your controllers/services) */
export const events = {
  orderCreated: (order: any) => getIO().to('admins').emit('orderCreated', order),
  orderStatusUpdated: (order: any) => getIO().to('admins').emit('orderStatusUpdated', order),
  notifyUser: (userId: string, payload: any) => getIO().to(userId).emit('notify', payload),
};
