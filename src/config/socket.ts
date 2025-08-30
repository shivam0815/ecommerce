// src/config/socket.ts
import { io, Socket } from 'socket.io-client';

type JoinPayload = { role?: 'admin'; userId?: string };

let socket: Socket | null = null;
// track what we've joined in THIS app session
let joined = { admin: false, userId: null as string | null };

const rawUrl =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  window.location.origin;

// Ensure origin (strip trailing /api if VITE_API_URL points at REST base)
const SOCKET_URL = rawUrl.replace(/\/api\/?$/, '');

const getToken = () =>
  localStorage.getItem('adminToken') ||
  localStorage.getItem('token') ||
  '';

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'], // keep polling fallback
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 15000,
    // refresh auth on every (re)connect
    auth: cb => cb({ token: getToken() }),
  });

  if (import.meta.env.DEV) {
    socket.on('connect', () => {
      console.log('🔌 [socket] connected:', socket?.id, '→', SOCKET_URL);
    });
    socket.on('disconnect', (reason) => {
      console.log('🔌 [socket] disconnected:', reason);
    });
    socket.on('connect_error', (err) => {
      console.warn('🔌 [socket] connect_error:', err?.message || err);
    });
    socket.on('reconnect_attempt', (n) => {
      console.log('🔁 [socket] reconnect attempt:', n);
    });
    socket.on('reconnect', (n) => {
      console.log('✅ [socket] reconnected on attempt:', n);
    });
  }

  return socket;
}

/** Emit joins ONLY after a successful connect, and only once per session. */
function joinOnConnect(payload: JoinPayload) {
  const s = getSocket();

  const doJoin = () => {
    // ADMIN
    if (payload.role === 'admin' && !joined.admin) {
      s.emit('join', { role: 'admin' } as JoinPayload);
      // DO NOT call legacy 'join-admin' too — it duplicates the server-side join
      joined.admin = true;
      if (import.meta.env.DEV) console.log('👑 [socket] joined admin room once');
    }

    // USER
    if (payload.userId && joined.userId !== payload.userId) {
      // switching rooms if different user
      s.emit('join', { userId: payload.userId } as JoinPayload);
      joined.userId = payload.userId;
      if (import.meta.env.DEV) console.log('👤 [socket] joined user room:', payload.userId);
    }
  };

  if (s.connected) {
    doJoin();
  } else {
    // fire once when connection happens
    const handler = () => {
      s.off('connect', handler);
      doJoin();
    };
    s.on('connect', handler);
  }
}

export function joinAdminRoom(): void {
  joinOnConnect({ role: 'admin' });
}

export function joinUserRoom(userId: string): void {
  if (!userId) return;
  joinOnConnect({ userId });
}

export function closeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  joined = { admin: false, userId: null }; // reset session flags
}
