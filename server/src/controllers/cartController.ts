// src/controllers/cartController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import Cart from "../models/Cart";
import Product from "../models/Product";

/* ────────────────────────────────────────────────────────────── */
/* CACHE                                                          */
/* ────────────────────────────────────────────────────────────── */
const cartCache = new NodeCache({ stdTTL: 10, checkperiod: 20 }); // cache per user 10s

/** ──────────────────────────────────────────────────────────────
 *  Global hard cap: no single cart line can exceed this quantity
 *  ────────────────────────────────────────────────────────────── */
const MAX_ORDER_QTY = 500;

/** Category-wise Minimum Order Quantity (MOQ) */
const CATEGORY_MOQ: Record<string, number> = {
  "Car Chargers": 50,
  "Bluetooth Neckbands": 50,
  TWS: 50,
  "Data Cables": 50,
  "Mobile Chargers": 50,
  "Bluetooth Speakers": 50,
  "Power Banks": 50,
  "Mobile ICs": 50,
  "Mobile Repairing Tools": 50,
  Electronics: 50,
  Accessories: 50,
  Others: 50,
};

/** Determine the effective MOQ for a product */
const getEffectiveMOQ = (product: any): number => {
  const pMOQ =
    typeof product?.minOrderQty === "number" && product.minOrderQty > 0
      ? product.minOrderQty
      : undefined;
  if (typeof pMOQ === "number") return pMOQ;

  const byCategory = CATEGORY_MOQ[product?.category || ""];
  return typeof byCategory === "number" && byCategory > 0 ? byCategory : 1;
};

/** Clamp helper: enforces [MOQ … min(stock, MAX_ORDER_QTY)] silently */
const clampQty = (desired: number, product: any): number => {
  const moq = getEffectiveMOQ(product);
  const stockCap = Math.max(0, Number(product?.stockQuantity ?? 0));
  const maxCap = Math.max(0, Math.min(stockCap, MAX_ORDER_QTY));
  const want = Math.max(1, Number(desired || 0));
  if (maxCap <= 0) return 0;
  return Math.max(moq, Math.min(want, maxCap));
};

interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
}

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

    const cart = await Cart.findOne({ userId: user.id }).populate("items.productId");
    const cartData = cart || { items: [], totalAmount: 0 };

    cartCache.set(cacheKey, cartData);
    res.json({ cart: cartData, cached: false });
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

    if (!cart) {
      const clamped = clampQty(Number(quantity) || 1, product);
      if (clamped < 1) {
        res.status(400).json({
          message: "Insufficient stock",
          available: product.stockQuantity,
          requested: Number(quantity) || 1,
        });
        return;
      }
      cart = new Cart({
        userId: user.id,
        items: [{ productId: product._id, quantity: clamped, price: product.price }],
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
        cart.items[existingItemIndex].price = product.price;
      } else {
        const clamped = clampQty(Number(quantity) || 1, product);
        if (clamped < 1) {
          res.status(400).json({
            message: "Insufficient stock",
            available: product.stockQuantity,
            requested: Number(quantity) || 1,
          });
          return;
        }
        cart.items.push({ productId: product._id, quantity: clamped, price: product.price });
      }
    }

    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(`cart:${user.id}`); // invalidate cache

    res.status(200).json({ success: true, message: "Item added to cart successfully", cart });
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

    const clamped = clampQty(Number(quantity) || 1, product);
    if (clamped < 1) {
      res.status(400).json({ message: "Insufficient stock" });
      return;
    }

    cart.items[itemIndex].quantity = clamped;
    cart.items[itemIndex].price = product.price;

    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(`cart:${user.id}`); // invalidate cache

    res.json({ message: "Cart updated", cart });
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

    await cart.save();
    await cart.populate("items.productId");

    cartCache.del(`cart:${user.id}`); // invalidate cache

    res.json({ message: "Item removed from cart", cart });
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
    await Cart.findOneAndDelete({ userId: user?.id });

    cartCache.del(`cart:${user.id}`); // invalidate cache

    res.json({ message: "Cart cleared" });
  } catch (error: any) {
    console.error("Clear cart error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};
