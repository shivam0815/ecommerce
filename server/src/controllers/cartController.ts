// src/controllers/cartController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import Cart from "../models/Cart";
import Product from "../models/Product";
import { resolveUnitPrice } from "../config/pricing"; // ✅ use this

/* ────────────────────────────────────────────────────────────── */
/* CACHE                                                          */
/* ────────────────────────────────────────────────────────────── */
const cartCache = new NodeCache({ stdTTL: 10, checkperiod: 20 }); // cache per user 10s

/** ──────────────────────────────────────────────────────────────
 *  Global hard cap: no single cart line can exceed this quantity
 *  ────────────────────────────────────────────────────────────── */
const MAX_ORDER_QTY = 1000;
const WHATSAPP_QTY_THRESHOLD = 110; // >100 routes to WhatsApp on UI
console.warn("⚠️ MAX_ORDER_QTY is set to", MAX_ORDER_QTY);

/** Category-wise Minimum Order Quantity (MOQ) */
const CATEGORY_MOQ: Record<string, number> = {
  "Car Chargers": 10,
  "Bluetooth Neckbands": 10,
  TWS: 10,
  "Data Cables": 10,
  "Mobile Chargers": 10,
  "Bluetooth Speakers": 10,
  "Power Banks": 10,
  "Mobile ICs": 10,
  "Mobile Repairing Tools": 10,
  Electronics: 10,
  Accessories: 10,
  Others: 10,
};

/* ────────────────────────────────────────────────────────────── */
/* MOQ / Step helpers                                             */
/* ────────────────────────────────────────────────────────────── */

const getEffectiveMOQ = (product: any): number => {
  const pMOQ =
    typeof product?.minOrderQty === "number" && product.minOrderQty > 0
      ? product.minOrderQty
      : undefined;
  if (typeof pMOQ === "number") return pMOQ;

  const byCategory = CATEGORY_MOQ[product?.category || ""];
  return typeof byCategory === "number" && byCategory > 0 ? byCategory : 1;
};

/** choose step size (current UX = MOQ) */
const getStepSize = (product: any): number => {
  const moq = getEffectiveMOQ(product);
  // If you want packSize/incrementStep enforced, swap to:
  // const step = Number(product?.incrementStep || product?.packSize || moq) || moq;
  const step = moq;
  return step < 1 ? 1 : step;
};

/** Clamp & snap (ceil to step) within [MOQ … min(stock, MAX_ORDER_QTY)] */
const clampQty = (desired: number, product: any): number => {
  const moq = getEffectiveMOQ(product);
  const step = getStepSize(product);
  const stockCap = Math.max(0, Number(product?.stockQuantity ?? 0));
  const hardMax = Math.max(0, Math.min(stockCap, MAX_ORDER_QTY));
  if (hardMax < moq) return 0; // not enough stock to meet MOQ

  const want = Math.max(1, Number(desired || 0));
  let snapped = Math.ceil(want / step) * step;

  if (snapped > hardMax) {
    snapped = Math.floor(hardMax / step) * step;
  }

  if (snapped < moq) return 0;
  return snapped;
};

/* ────────────────────────────────────────────────────────────── */
/* Auth interface                                                */
/* ────────────────────────────────────────────────────────────── */
interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
}

/* ────────────────────────────────────────────────────────────── */
/* Utility: recompute cart money + flags                         */
/* ────────────────────────────────────────────────────────────── */
const recomputeCartAndFlags = async (cartDoc: any) => {
  let total = 0;
  let requiresWhatsapp = false;

  // Ensure products are populated for pricing + category/minOrderQty etc.
  await cartDoc.populate("items.productId");

  cartDoc.items = cartDoc.items.map((it: any) => {
    const p = it.productId;
    if (!p || !p.isActive || !p.inStock) return it;

    // re-clamp server-side to avoid client bypass
    const clamped = clampQty(it.quantity, p);
    if (clamped < 1) return it;
    it.quantity = clamped;

    // ✅ dynamic pricing per line based on qty (shared helper)
    const unitPrice = Number(resolveUnitPrice(p, clamped)) || Number(p.price) || 0;
    it.price = unitPrice; // store final unit price on the line

    const lineTotal = unitPrice * clamped;
    total += lineTotal;

    // ✅ WhatsApp gate: ONLY if strictly greater than 100
    if (clamped > WHATSAPP_QTY_THRESHOLD) {
      requiresWhatsapp = true;
    }

    return it;
  });

  cartDoc.totalAmount = Math.max(0, Math.floor(total));
  return { requiresWhatsapp };
};

/* ────────────────────────────────────────────────────────────── */
/* GET CART                                                       */
/* ────────────────────────────────────────────────────────────── */
export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    if (!user?.id) {
      res.status(401).json({ message: "Unauthorized: No user id" });
      return;
    }

    const cacheKey = `cart:${user.id}`;
    const cached = cartCache.get(cacheKey);
    if (cached) {
      res.json({ cart: cached, cached: true });
      return;
    }

    const cart = await Cart.findOne({ userId: user.id });
    const cartData = cart || new Cart({ userId: user.id, items: [], totalAmount: 0 });

    // Always recompute totals/prices/flags on read for integrity
    const { requiresWhatsapp } = await recomputeCartAndFlags(cartData);
    await cartData.save();

    cartCache.set(cacheKey, cartData);
    res.json({ cart: cartData, requiresWhatsapp, cached: false });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ADD TO CART                                                    */
/* ────────────────────────────────────────────────────────────── */
export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    const user = req.user as AuthenticatedUser;

    if (!productId || !user?.id) {
      res.status(400).json({ message: "Product ID and user authentication required" });
      return;
    }

    // Find product
    let product: any;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    } else {
      // Fallback index mode (kept from your code)
      const allProducts = await Product.find({ isActive: true }).sort({ createdAt: 1 });
      const productIndex = parseInt(productId, 10) - 1;
      if (productIndex >= 0 && productIndex < allProducts.length) {
        product = allProducts[productIndex];
      }
    }

    if (!product || !product.isActive || !product.inStock) {
      res.status(404).json({ message: "Product not found or unavailable" });
      return;
    }

    if (product.stockQuantity < 1) {
      res.status(400).json({
        message: "Insufficient stock",
        available: product.stockQuantity,
        requested: Number(quantity) || 1,
      });
      return;
    }

    let cart = await Cart.findOne({ userId: user.id });

    const initialClamp = clampQty(Number(quantity) || 1, product);
    if (initialClamp < 1) {
      res.status(400).json({
        message: "Insufficient stock",
        available: product.stockQuantity,
        requested: Number(quantity) || 1,
      });
      return;
    }

    if (!cart) {
      cart = new Cart({
        userId: user.id,
        items: [{ productId: product._id, quantity: initialClamp, price: 0 }], // price filled by recompute
      });
    } else {
      const existingItemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === product._id.toString()
      );

      if (existingItemIndex > -1) {
        const desired = cart.items[existingItemIndex].quantity + Number(quantity || 0);
        const clamped = clampQty(desired, product);
        if (clamped < 1) {
          res.status(400).json({
            message: "Cannot add more items - insufficient stock",
            available: product.stockQuantity,
            currentInCart: cart.items[existingItemIndex].quantity,
          });
          return;
        }
        cart.items[existingItemIndex].quantity = clamped;
        // price will be recomputed with dynamic pricing
      } else {
        cart.items.push({ productId: product._id, quantity: initialClamp, price: 0 });
      }
    }

    // Recompute prices/totals/flags
    const { requiresWhatsapp } = await recomputeCartAndFlags(cart);
    await cart.save();

    // send populated
    await cart.populate("items.productId");

    cartCache.del(`cart:${user.id}`); // invalidate cache

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      cart,
      requiresWhatsapp,
    });
  } catch (error: any) {
    console.error("❌ Add to cart error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* UPDATE CART ITEM                                               */
/* ────────────────────────────────────────────────────────────── */
export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity } = req.body;
    const user = req.user as AuthenticatedUser;

    if (Number(quantity) < 1) {
      res.status(400).json({ message: "Quantity must be at least 1" });
      return;
    }

    const cart = await Cart.findOne({ userId: user?.id });
    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === String(productId)
    );
    if (itemIndex === -1) {
      res.status(404).json({ message: "Item not found in cart" });
      return;
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive || !product.inStock) {
      res.status(404).json({ message: "Product not found or unavailable" });
      return;
    }
    if (product.stockQuantity < 1) {
      res.status(400).json({ message: "Insufficient stock" });
      return;
    }

    // clamp to MOQ/step/stock
    const clamped = clampQty(Number(quantity) || 1, product);
    if (clamped < 1) {
      res.status(400).json({ message: "Insufficient stock" });
      return;
    }

    cart.items[itemIndex].quantity = clamped;
    // price recalculated in recompute step

    const { requiresWhatsapp } = await recomputeCartAndFlags(cart);
    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(`cart:${user.id}`); // invalidate cache

    res.json({ message: "Cart updated", cart, requiresWhatsapp });
  } catch (error: any) {
    console.error("Update cart error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* REMOVE FROM CART                                               */
/* ────────────────────────────────────────────────────────────── */
export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const user = req.user as AuthenticatedUser;

    const cart = await Cart.findOne({ userId: user?.id });
    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    cart.items = cart.items.filter((item) => item.productId.toString() !== String(productId));

    const { requiresWhatsapp } = await recomputeCartAndFlags(cart);
    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(`cart:${user.id}`); // invalidate cache

    res.json({ message: "Item removed from cart", cart, requiresWhatsapp });
  } catch (error: any) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* CLEAR CART                                                     */
/* ────────────────────────────────────────────────────────────── */
export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;

    const existing = await Cart.findOne({ userId: user?.id });
    if (existing) {
      await Cart.findOneAndDelete({ userId: user?.id });
    }

    cartCache.del(`cart:${user.id}`); // invalidate cache
    res.json({ message: "Cart cleared" });
  } catch (error: any) {
    console.error("Clear cart error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};
