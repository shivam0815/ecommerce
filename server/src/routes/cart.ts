import express from 'express';
import { authenticate } from '../middleware/auth';
import { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart,
   // ← Import your debug function
} from '../controllers/cartController';

const router = express.Router();

// ✅ PUBLIC DEBUG ROUTE (before authentication)
// router.get('/debug/products', debugProducts);

// ✅ PROTECTED ROUTES (after authentication)
router.use(authenticate); // Authentication middleware applied here

router.get('/', getCart);
router.post('/', addToCart);
router.put('/item', updateCartItem);
router.delete('/item/:productId', removeFromCart);
router.delete('/clear', clearCart);

export default router;
