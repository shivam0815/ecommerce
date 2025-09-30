// src/controllers/cartController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import Cart from "../models/Cart";
import Product from "../models/Product";
import { resolveUnitPrice } from "../config/pricing"; // ✅ dynamic pricing source

/* ────────────────────────────────────────────────────────────── */
/* TYPES                                                         */
/* ────────────────────────────────────────────────────────────── */
interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
}

/* ────────────────────────────────────────────────────────────── */
/* CACHE (per-user cart cache ~10s)                              */
/* ────────────────────────────────────────────────────────────── */
const cartCache = new NodeCache({ stdTTL: 10, checkperiod: 20 });

/* ────────────────────────────────────────────────────────────── */
/* LIMITS & RULES                                                */
/* ────────────────────────────────────────────────────────────── */
const MAX_ORDER_QTY = 1000;
/**
 * Business rule:
 *   - Show price & allow checkout up to 100
 *   - For quantities > 100, route to WhatsApp
 */
const WHATSAPP_AFTER_QTY = 100;

console.warn("⚠️ MAX_ORDER_QTY is set to", MAX_ORDER_QTY, "— WhatsApp after", WHATSAPP_AFTER_QTY);

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
/* HELPERS                                                       */
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

const getStepSize = (product: any): number => {
  const moq = getEffectiveMOQ(product);
  return moq < 1 ? 1 : moq; // step == MOQ (simple rule)
};

const clampQty = (desired: number, product: any): number => {
  const moq = getEffectiveMOQ(product);
  const step = getStepSize(product);
  const stockCap = Math.max(0, Number(product?.stockQuantity ?? 0));
  const hardMax = Math.max(0, Math.min(stockCap, MAX_ORDER_QTY));
  if (hardMax < moq) return 0;

  const want = Math.max(1, Number(desired || 0));
  let snapped = Math.ceil(want / step) * step;

  if (snapped > hardMax) {
    snapped = Math.floor(hardMax / step) * step;
  }

  if (snapped < moq) return 0;
  return snapped;
};

const shouldRouteToWhatsapp = (qty: number) => qty > WHATSAPP_AFTER_QTY;

/**
 * Recompute line prices (dynamic), apply caps, total & flags.
 * - Caps any stray legacy line items to 100 (keeps cart valid)
 * - Flags requiresWhatsapp if any line tried to exceed 100
 */
const recomputeCartAndFlags = async (cartDoc: any) => {
  let total = 0;
  let requiresWhatsapp = false;

  await cartDoc.populate("items.productId");

  cartDoc.items = cartDoc.items.map((it: any) => {
    const p = it.productId;
    if (!p || !p.isActive || !p.inStock) return it;

    let clamped = clampQty(it.quantity, p);
    if (clamped < 1) return it;

    if (shouldRouteToWhatsapp(clamped)) {
      requiresWhatsapp = true;
      // Cap to 100 so totals are coherent; UI will prompt WA anyway.
      clamped = WHATSAPP_AFTER_QTY;
    }

    it.quantity = clamped;

    const unitPrice = Number(resolveUnitPrice(p, clamped)) || Number(p.price) || 0;
    it.price = unitPrice;

    total += unitPrice * clamped;
    return it;
  });

  cartDoc.totalAmount = Math.max(0, Math.floor(total));
  return { requiresWhatsapp };
};

/** Utility: read user from req safely */
const getAuthedUser = (req: Request): AuthenticatedUser | undefined =>
  (req.user as AuthenticatedUser | undefined);

/** Utility: get cache key for a user */
const cacheKeyFor = (userId: string) => `cart:${userId}`;

/** Ensure a cart exists for this user (in-memory doc if missing) */
const getOrInitCart = async (userId: string) => {
  const found = await Cart.findOne({ userId });
  return found || new Cart({ userId, items: [], totalAmount: 0 });
};

/* ────────────────────────────────────────────────────────────── */
/* CONTROLLERS                                                   */
/* ────────────────────────────────────────────────────────────── */

/** GET /cart */
export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthedUser(req);
    if (!user?.id) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please log in to view your cart.",
      });
      return;
    }

    const key = cacheKeyFor(user.id);
    const cached = cartCache.get(key);
    if (cached) {
      res.json({ success: true, cart: cached, cached: true, whatsappAfterQty: WHATSAPP_AFTER_QTY });
      return;
    }

    const cart = await getOrInitCart(user.id);
    const { requiresWhatsapp } = await recomputeCartAndFlags(cart);

    // Drop any lines that ended up <1
    cart.items = cart.items.filter((it: any) => Number(it.quantity) > 0);
    await cart.save();

    cartCache.set(key, cart);
    res.json({ success: true, cart, requiresWhatsapp, whatsappAfterQty: WHATSAPP_AFTER_QTY, cached: false });
  } catch (error: any) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error?.message || "Server error",
    });
  }
};

/** POST /cart  (body: { productId, quantity? }) */
export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    const user = getAuthedUser(req);

    if (!user?.id) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please log in to add items to your cart.",
      });
      return;
    }
    if (!productId) {
      res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "Product ID is required",
      });
      return;
    }

    // Support either ObjectId or positional numeric id (legacy/testing)
    let product: any;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    } else {
      const allProducts = await Product.find({ isActive: true }).sort({ createdAt: 1 });
      const productIndex = parseInt(productId, 10) - 1;
      if (productIndex >= 0 && productIndex < allProducts.length) {
        product = allProducts[productIndex];
      }
    }

    if (!product || !product.isActive || !product.inStock) {
      res.status(404).json({
        success: false,
        code: "PRODUCT_UNAVAILABLE",
        message: "Product not found or unavailable",
      });
      return;
    }
    if (product.stockQuantity < 1) {
      res.status(400).json({
        success: false,
        code: "OUT_OF_STOCK",
        message: "Insufficient stock",
        available: product.stockQuantity,
        requested: Number(quantity) || 1,
      });
      return;
    }

    const initialClamp = clampQty(Number(quantity) || 1, product);
    if (initialClamp < 1) {
      res.status(400).json({
        success: false,
        code: "OUT_OF_STOCK",
        message: "Insufficient stock",
        available: product.stockQuantity,
        requested: Number(quantity) || 1,
      });
      return;
    }

    // 🚫 Enforce WhatsApp-only beyond 100
    if (shouldRouteToWhatsapp(initialClamp)) {
      res.status(409).json({
        success: false,
        code: "WHATSAPP_REQUIRED",
        message: `For quantities above ${WHATSAPP_AFTER_QTY}, please enquire on WhatsApp.`,
        whatsappAfterQty: WHATSAPP_AFTER_QTY,
      });
      return;
    }

    let cart = await Cart.findOne({ userId: user.id });
    if (!cart) {
      cart = new Cart({
        userId: user.id,
        items: [{ productId: product._id, quantity: initialClamp, price: 0 }],
      });
    } else {
      const existingItemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === product._id.toString()
      );

      if (existingItemIndex > -1) {
        const desired =
          Number(cart.items[existingItemIndex].quantity || 0) +
          Number(quantity || 0);
        const clamped = clampQty(desired, product);

        if (clamped < 1) {
          res.status(400).json({
            success: false,
            code: "OUT_OF_STOCK",
            message: "Cannot add more items - insufficient stock",
            available: product.stockQuantity,
            currentInCart: cart.items[existingItemIndex].quantity,
          });
          return;
        }

        if (shouldRouteToWhatsapp(clamped)) {
          res.status(409).json({
            success: false,
            code: "WHATSAPP_REQUIRED",
            message: `For quantities above ${WHATSAPP_AFTER_QTY}, please enquire on WhatsApp.`,
            whatsappAfterQty: WHATSAPP_AFTER_QTY,
          });
          return;
        }

        cart.items[existingItemIndex].quantity = clamped;
      } else {
        cart.items.push({
          productId: product._id,
          quantity: initialClamp,
          price: 0, // set by recompute
        } as any);
      }
    }

    const { requiresWhatsapp } = await recomputeCartAndFlags(cart);
    cart.items = cart.items.filter((it: any) => Number(it.quantity) > 0);

    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(cacheKeyFor(user.id));
    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      cart,
      requiresWhatsapp,
      whatsappAfterQty: WHATSAPP_AFTER_QTY,
    });
  } catch (error: any) {
    console.error("❌ Add to cart error:", error);
    res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error?.message || "Internal server error",
    });
  }
};

/** PUT /cart/item  (body: { productId, quantity }) */
export const updateCartItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = getAuthedUser(req);
    if (!user?.id) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please log in to update your cart.",
      });
      return;
    }

    const { productId, quantity } = req.body;
    if (!productId) {
      res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "productId is required",
      });
      return;
    }
    if (Number(quantity) < 1) {
      res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "Quantity must be at least 1",
      });
      return;
    }

    const cart = await Cart.findOne({ userId: user.id });
    if (!cart) {
      res.status(404).json({
        success: false,
        code: "CART_NOT_FOUND",
        message: "Cart not found",
      });
      return;
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === String(productId)
    );
    if (itemIndex === -1) {
      res.status(404).json({
        success: false,
        code: "ITEM_NOT_IN_CART",
        message: "Item not found in cart",
      });
      return;
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive || !product.inStock) {
      res.status(404).json({
        success: false,
        code: "PRODUCT_UNAVAILABLE",
        message: "Product not found or unavailable",
      });
      return;
    }
    if (product.stockQuantity < 1) {
      res.status(400).json({
        success: false,
        code: "OUT_OF_STOCK",
        message: "Insufficient stock",
      });
      return;
    }

    const clamped = clampQty(Number(quantity) || 1, product);
    if (clamped < 1) {
      res.status(400).json({
        success: false,
        code: "OUT_OF_STOCK",
        message: "Insufficient stock",
      });
      return;
    }

    // 🚫 Enforce WhatsApp-only beyond 100
    if (shouldRouteToWhatsapp(clamped)) {
      res.status(409).json({
        success: false,
        code: "WHATSAPP_REQUIRED",
        message: `For quantities above ${WHATSAPP_AFTER_QTY}, please enquire on WhatsApp.`,
        whatsappAfterQty: WHATSAPP_AFTER_QTY,
      });
      return;
    }

    cart.items[itemIndex].quantity = clamped;

    const { requiresWhatsapp } = await recomputeCartAndFlags(cart);
    cart.items = cart.items.filter((it: any) => Number(it.quantity) > 0);

    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(cacheKeyFor(user.id));
    res.json({ success: true, message: "Cart updated", cart, requiresWhatsapp, whatsappAfterQty: WHATSAPP_AFTER_QTY });
  } catch (error: any) {
    console.error("Update cart error:", error);
    res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error?.message || "Server error",
    });
  }
};

/** DELETE /cart/item/:productId */
export const removeFromCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = getAuthedUser(req);
    if (!user?.id) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please log in to modify your cart.",
      });
      return;
    }

    const { productId } = req.params;
    const cart = await Cart.findOne({ userId: user.id });
    if (!cart) {
      res.status(404).json({
        success: false,
        code: "CART_NOT_FOUND",
        message: "Cart not found",
      });
      return;
    }

    const before = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== String(productId)
    );
    if (cart.items.length === before) {
      res.status(404).json({
        success: false,
        code: "ITEM_NOT_IN_CART",
        message: "Item not found in cart",
      });
      return;
    }

    const { requiresWhatsapp } = await recomputeCartAndFlags(cart);
    cart.items = cart.items.filter((it: any) => Number(it.quantity) > 0);

    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(cacheKeyFor(user.id));
    res.json({
      success: true,
      message: "Item removed from cart",
      cart,
      requiresWhatsapp,
      whatsappAfterQty: WHATSAPP_AFTER_QTY,
    });
  } catch (error: any) {
    console.error("Remove from cart error:", error);
    res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error?.message || "Server error",
    });
  }
};

/** POST /cart/merge  (body: { items: [{ productId, qty|quantity }] }) */
export const mergeGuestCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = getAuthedUser(req);
    if (!user?.id) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please log in to merge your cart.",
      });
      return;
    }

    const incoming = Array.isArray((req.body as any)?.items)
      ? (req.body as any).items
      : [];

    // Normalize & dedupe guest items (cap each blob to 100 here itself)
    const map = new Map<string, { productId: string; qty: number }>();
    for (const it of incoming) {
      const pid = String(it?.productId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(pid)) continue;
      let qty = Math.max(1, Math.min(Number(it?.qty ?? it?.quantity ?? 1) || 1, 100));
      const key = `${pid}::`; // variant placeholder
      const prev = map.get(key);
      if (prev) prev.qty = Math.min(100, prev.qty + qty);
      else map.set(key, { productId: pid, qty });
    }
    const guestItems = Array.from(map.values());

    const cart = await getOrInitCart(user.id);

    if (!guestItems.length) {
      const { requiresWhatsapp } = await recomputeCartAndFlags(cart);
      cart.items = cart.items.filter((it: any) => Number(it.quantity) > 0);
      await cart.save();
      await cart.populate("items.productId");
      cartCache.del(cacheKeyFor(user.id));
      res.json({
        success: true,
        cart,
        requiresWhatsapp,
        whatsappAfterQty: WHATSAPP_AFTER_QTY,
        message: "No guest items to merge",
      });
      return;
    }

    // Merge lines
    for (const g of guestItems) {
      const idx = cart.items.findIndex(
        (line: any) => String(line.productId) === g.productId
      );
      if (idx >= 0) {
        cart.items[idx].quantity = Math.min(
          WHATSAPP_AFTER_QTY, // cap to 100 during merge
          Number(cart.items[idx].quantity || 0) + g.qty
        );
      } else {
        cart.items.push({
          productId: new mongoose.Types.ObjectId(g.productId),
          quantity: Math.min(WHATSAPP_AFTER_QTY, g.qty),
          price: 0, // recomputed
        } as any);
      }
    }

    const { requiresWhatsapp } = await recomputeCartAndFlags(cart);
    cart.items = cart.items.filter((it: any) => Number(it.quantity) > 0);

    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(cacheKeyFor(user.id));
    res.json({
      success: true,
      cart,
      requiresWhatsapp,
      whatsappAfterQty: WHATSAPP_AFTER_QTY,
      message: "Guest cart merged",
    });
  } catch (error: any) {
    console.error("Cart merge failed:", error);
    res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error?.message || "Cart merge failed",
    });
  }
};

/** DELETE /cart/clear */
export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthedUser(req);
    if (!user?.id) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please log in to clear your cart.",
      });
      return;
    }

    const existing = await Cart.findOne({ userId: user.id });
    if (existing) {
      await Cart.findOneAndDelete({ userId: user.id });
    }

    cartCache.del(cacheKeyFor(user.id));
    res.json({ success: true, message: "Cart cleared" });
  } catch (error: any) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error?.message || "Server error",
    });
  }
};
