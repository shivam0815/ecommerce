import { Router } from 'express';
import {
  listMyNotifications,
  markOneRead,
  markAllRead,
  removeOne,
  adminListNotifications,
  adminCreateNotification,
  adminDeleteNotification,
} from '../controllers/notification.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// USER endpoints
router.get('/user/notifications', authenticate, listMyNotifications);
router.patch('/user/notifications/:id/read', authenticate, markOneRead);
router.patch('/user/notifications/mark-all-read', authenticate, markAllRead);
router.delete('/user/notifications/:id', authenticate, removeOne);

// ADMIN endpoints
router.get(
  '/admin/notifications',
  authenticate,
  authorize(['admin']),
  adminListNotifications
);

router.post(
  '/admin/notifications',
  authenticate,
  authorize(['admin']),
  adminCreateNotification
);

router.delete(
  '/admin/notifications/:id',
  authenticate,
  authorize(['admin']),
  adminDeleteNotification
);


export default router;
