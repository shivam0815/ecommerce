import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart
} from '../controllers/cartController';

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* RATE LIMIT                                                                 */
/* -------------------------------------------------------------------------- */
const cartLimiter = rateLimit({
  windowMs: 10 * 1000,      // 10 seconds
  max: 20,                  // max 20 requests per 10s per IP
  message: { success: false, message: "Too many cart requests, slow down." },
  standardHeaders: true,    // Return rate limit info in the headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
});

/* -------------------------------------------------------------------------- */
/* ROUTES                                                                     */
/* -------------------------------------------------------------------------- */
// ✅ Protect routes
router.use(authenticate);

// ✅ Apply limiter only to cart routes
router.get('/', cartLimiter, getCart);
router.post('/', cartLimiter, addToCart);
router.put('/item', cartLimiter, updateCartItem);
router.delete('/item/:productId', cartLimiter, removeFromCart);
router.delete('/clear', cartLimiter, clearCart);

export default router;
