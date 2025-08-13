// src/routes/payment.ts - Keep simple
import express from 'express';
import { authenticate } from '../middleware/auth';
import { 
  createPaymentOrder, 
  verifyPayment, 
  getPaymentStatus 
} from '../controllers/paymentController';

const router = express.Router();

// ✅ These should now work without TypeScript errors
router.post('/create-order', authenticate, createPaymentOrder);
router.post('/verify', authenticate, verifyPayment);
router.get('/status/:orderId', authenticate, getPaymentStatus);

export default router;
