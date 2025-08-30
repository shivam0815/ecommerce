import express from 'express';
import {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  getAllOrders,
  getOrderDetails,
  getOrderByIdAdmin,
  // ⬇️ make sure these two are exported from your controller file
  cancelOrder,
  trackOrder,
} from '../controllers/orderController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

/**
 * Admin routes FIRST (and specific) – so they don't get captured by /:id
 */
router.get('/admin/all', authenticate, authorize(['admin', 'super_admin']), getAllOrders);
router.get('/admin/:id', authenticate, authorize(['admin', 'super_admin']), getOrderByIdAdmin);
router.put('/:id/status', authenticate, authorize(['admin', 'super_admin']), updateOrderStatus);

/**
 * User routes
 */
router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);

// Details expects :orderId (per your controller)
router.get('/details/:orderId', authenticate, getOrderDetails);

/**
 * NEW: Track + Cancel
 * - Track also expects :orderId (matches your controller)
 * - Cancel expects :id (matches your controller)
 * Keep these ABOVE '/:id' so the generic matcher doesn't swallow them.
 */
router.get('/track/:orderId', authenticate, trackOrder);
router.post('/:id/cancel', authenticate, cancelOrder);

// Keep this LAST so it doesn’t shadow the others
router.get('/:id', authenticate, getOrder);

export default router;
