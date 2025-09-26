import express from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeGuestCart,
} from "../controllers/cartController";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* RATE LIMIT                                                                 */
/* -------------------------------------------------------------------------- */
const cartLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20,             // max 20 requests per 10s per IP
  message: {
    success: false,
    code: "RATE_LIMIT",
    message: "Too many cart requests, slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/* -------------------------------------------------------------------------- */
/* ROUTES (all protected)                                                     */
/* -------------------------------------------------------------------------- */
router.use(authenticate);

router.get("/", cartLimiter, getCart);
router.post("/", cartLimiter, addToCart);

router.put("/item", cartLimiter, updateCartItem);
router.delete("/item/:productId", cartLimiter, removeFromCart);

router.post("/merge", cartLimiter, mergeGuestCart);
router.delete("/clear", cartLimiter, clearCart);

export default router;
