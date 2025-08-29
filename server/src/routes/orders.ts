import express from 'express';
import {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  getAllOrders,
  getOrderDetails,
  getOrderByIdAdmin,         // <-- add this export in your controller (shown below)
} from '../controllers/orderController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

/**
 * Admin routes FIRST (and specific) – so they don't get captured by /:id
 */
router.get('/admin/all', authenticate, authorize(['admin', 'super_admin']), getAllOrders);
// routes/orders.ts
router.get('/admin/:id', authenticate, authorize(['admin','super_admin']), getOrderByIdAdmin);

router.put('/:id/status', authenticate, authorize(['admin', 'super_admin']), updateOrderStatus);

/**
 * User routes
 */
router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);

// Use a different path for the “details” version since the controller expects :orderId
router.get('/details/:orderId', authenticate, getOrderDetails);

// Keep this LAST so it doesn’t shadow the others
router.get('/:id', authenticate, getOrder);

export default router;
