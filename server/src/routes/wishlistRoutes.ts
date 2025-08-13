import express from 'express';
import { authenticate} from '../middleware/auth';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist
} from '../controllers/wishlistController';

const router = express.Router();

router.get('/', authenticate, getWishlist);
router.post('/', authenticate, addToWishlist);
router.delete('/:productId', authenticate, removeFromWishlist);
router.delete('/clear', authenticate, clearWishlist);

export default router;
