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

export function initSocket(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: FRONTEND_ORIGINS,
      credentials: true,
      methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    },
    transports: ['websocket','polling'], // allow fallback
  });

  io.on('connection', (socket: Socket) => {
    console.log('🔌 socket connected:', socket.id);

    // unified join
    socket.on('join', ({ role, userId }: { role?: string; userId?: string }) => {
      if (role === 'admin') {
        socket.join('admins');
        console.log('👑 joined admins:', socket.id);
      }
      if (userId) {
        socket.join(userId);
        console.log('👤 joined user room:', userId, socket.id);
      }
    });

    // legacy/explicit joins (optional)
    socket.on('join-admin', () => socket.join('admins'));
    socket.on('join-user', (payload: { userId?: string } | string) => {
      const userId = typeof payload === 'string' ? payload : payload?.userId;
      if (userId) socket.join(userId);
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
