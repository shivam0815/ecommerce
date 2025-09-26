// src/routes/cart.ts
import express from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth";  // ✅ ensure this is a named export
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart, mergeGuestCart
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
    message: "Too many cart requests, slow down.",
  } as any,            // ✅ cast to any if TS complains about message type
  standardHeaders: true,
  legacyHeaders: false,
});

/* -------------------------------------------------------------------------- */
/* ROUTES                                                                     */
/* -------------------------------------------------------------------------- */
router.use(authenticate); // ✅ Protect routes

router.get("/", cartLimiter, getCart);
router.post("/", cartLimiter, addToCart);
router.put("/item", cartLimiter, updateCartItem);
router.delete("/item/:productId", cartLimiter, removeFromCart);
router.post("/merge", cartLimiter, mergeGuestCart);

router.delete("/clear", cartLimiter, clearCart);

export default router;
