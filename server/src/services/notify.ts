import { Server } from 'socket.io';
import NotificationModel from '../models/Notification'; // if you already have one; else stub it.

type NotifyType = 'order' | 'promo' | 'system' | 'product' | 'announcement' | 'return';

export async function notifyUser(
  userId: string,
  payload: { title: string; message: string; type?: NotifyType; cta?: { label?: string; href?: string } },
  io?: Server
) {
  try {
    // Optional DB save if you have a Notification model
    if (NotificationModel) {
      await NotificationModel.create({
        user: userId,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'system',
        cta: payload.cta,
      });
    }
  } catch {
    /* non-fatal */
  }
  // emit to user's room (client joins by userId)
  io?.to(userId).emit('notification', payload);
}

export function emitAdmin(io: Server | undefined, event: string, data: any) {
  io?.to('admin').emit(event, data); // assuming your admins join 'admin' room
}
