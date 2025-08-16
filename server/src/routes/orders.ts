import express from 'express';
import {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  getAllOrders,
  getOrderDetails
} from '../controllers/orderController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

/**
 * Admin routes first — to avoid being captured by /:id
 */
router.get('/admin/all', authenticate, authorize(['admin']), getAllOrders);
router.put('/:id/status', authenticate, authorize(['admin']), updateOrderStatus);

/**
 * User routes
 */
router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);
router.get('/:id', authenticate, getOrder);
// Use ONE dynamic route for details
router.get('/:id', authenticate, getOrderDetails);

export default router;
