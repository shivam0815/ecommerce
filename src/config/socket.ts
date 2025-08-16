// src/config/socket.ts
import { io, Socket } from 'socket.io-client';

type JoinPayload = { role: 'admin' } | { userId: string };

let socket: Socket | null = null;

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  window.location.origin;

const getToken = () =>
  localStorage.getItem('adminToken') ||
  localStorage.getItem('token') ||
  '';

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      withCredentials: true,
      // let it fall back to polling if ws can’t upgrade
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 15000,
      // use function-style auth so it refreshes the token
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
  }

  return socket;
}

export function joinAdminRoom(): void {
  const s = getSocket();
  s.emit('join', { role: 'admin' } as JoinPayload);
  s.emit('join-admin');   // for your legacy handler
}

export function joinUserRoom(userId: string): void {
  if (!userId) return;
  const s = getSocket();
  s.emit('join', { userId } as JoinPayload);
  s.emit('join-user', userId); // your server expects a string in the legacy handler
}

export function closeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
