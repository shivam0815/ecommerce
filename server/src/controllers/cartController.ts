// src/controllers/cartController.ts - SIMPLIFIED FIXED VERSION
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Cart from '../models/Cart';
import Product from '../models/Product';

interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
}

export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    
    if (!user?.id) {
      res.status(401).json({ message: 'Unauthorized: No user id' });
      return;
    }

    const cart = await Cart.findOne({ userId: user.id }).populate('items.productId');
    
    if (!cart) {
      res.json({ cart: { items: [], totalAmount: 0 } });
      return;
    }

    res.json({ cart });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    const user = req.user as AuthenticatedUser;

    // Validate inputs
    if (!productId || !user?.id) {
      res.status(400).json({
        message: 'Product ID and user authentication required'
      });
      return;
    }

    // Find product
    let product;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    } else {
      // Handle simple numeric IDs (1, 2, 3, etc.)
      const allProducts = await Product.find({ isActive: true }).sort({ createdAt: 1 });
      const productIndex = parseInt(productId) - 1;
      
      if (productIndex >= 0 && productIndex < allProducts.length) {
        product = allProducts[productIndex];
      }
    }

    if (!product || !product.isActive || !product.inStock) {
      res.status(404).json({ message: 'Product not found or unavailable' });
      return;
    }

    if (product.stockQuantity < quantity) {
      res.status(400).json({
        message: 'Insufficient stock',
        available: product.stockQuantity,
        requested: quantity
      });
      return;
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: user.id });
    
    if (!cart) {
      cart = new Cart({
        userId: user.id,
        items: [{
          productId: product._id,
          quantity: Number(quantity),
          price: product.price
        }]
      });
    } else {
      const existingItemIndex = cart.items.findIndex(
        item => item.productId.toString() === product._id.toString()
      );

      if (existingItemIndex > -1) {
        const newQuantity = cart.items[existingItemIndex].quantity + Number(quantity);
        
        if (newQuantity > product.stockQuantity) {
          res.status(400).json({
            message: 'Cannot add more items - insufficient stock',
            available: product.stockQuantity,
            currentInCart: cart.items[existingItemIndex].quantity
          });
          return;
        }

        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].price = product.price;
      } else {
        cart.items.push({
          productId: product._id,
          quantity: Number(quantity),
          price: product.price
        });
      }
    }

    await cart.save();
    await cart.populate('items.productId');

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      cart: cart
    });
  } catch (error: any) {
    console.error('❌ Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity } = req.body;
    const user = req.user as AuthenticatedUser;

    if (quantity < 1) {
      res.status(400).json({ message: 'Quantity must be at least 1' });
      return;
    }

    const cart = await Cart.findOne({ userId: user?.id });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product || product.stockQuantity < quantity) {
      res.status(400).json({ message: 'Insufficient stock' });
      return;
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].price = product.price;

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      message: 'Cart updated',
      cart
    });
  } catch (error: any) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const user = req.user as AuthenticatedUser;

    const cart = await Cart.findOne({ userId: user?.id });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter(
      item => item.productId.toString() !== productId
    );

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      message: 'Item removed from cart',
      cart
    });
  } catch (error: any) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    await Cart.findOneAndDelete({ userId: user?.id });
    res.json({ message: 'Cart cleared' });
  } catch (error: any) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};
