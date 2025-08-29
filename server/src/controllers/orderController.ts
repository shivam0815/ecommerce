// src/controllers/orderController.ts - COMPLETE VERSION WITH EMAIL AUTOMATION + MAX(50) & MOQ CLAMPING
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order, { IOrder } from '../models/Order';
import Cart from '../models/Cart';
import Product from '../models/Product';
// import OrderProcessingService from '../services/OrderProcessingService';
// import InventoryService from '../services/InventoryService';
import EmailAutomationService from '../config/emailService';
import type {} from '../types/express';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Global MAX per line item + Category-wise MOQ (silent clamp)
 * (Same rules as in cartController)
 * ────────────────────────────────────────────────────────────────────────────*/
const MAX_ORDER_QTY = 50;

const CATEGORY_MOQ: Record<string, number> = {
  'Car Chargers': 2,
  'Bluetooth Neckbands': 5,
  'TWS': 3,
  'Data Cables': 5,
  'Mobile Chargers': 2,
  'Bluetooth Speakers': 2,
  'Power Banks': 2,
  'Mobile ICs': 1,
  'Mobile Repairing Tools': 1,
  'Electronics': 1,
  'Accessories': 1,
  'Others': 1,
};

const getEffectiveMOQ = (product: any): number => {
  const pMOQ =
    typeof product?.minOrderQty === 'number' && product.minOrderQty > 0
      ? product.minOrderQty
      : undefined;
  if (typeof pMOQ === 'number') return pMOQ;

  const byCategory = CATEGORY_MOQ[product?.category || ''];
  return typeof byCategory === 'number' && byCategory > 0 ? byCategory : 1;
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

// ✅ CREATE ORDER WITH EMAIL AUTOMATION INTEGRATION
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shippingAddress, paymentMethod, billingAddress } = req.body;

    if (!req.user) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const userId = user.id;

    console.log('🛒 Creating order for user:', userId);

    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || !cart.items || cart.items.length === 0) {
      res.status(400).json({ message: 'Cart is empty' });
      return;
    }

    const orderItems: Array<{
      productId: mongoose.Types.ObjectId;
      name: string;
      price: number;
      quantity: number;
      image: string;
    }> = [];

    let subtotal = 0;

    // Validate/clamp and build order items (SILENTLY)
    for (const cartItem of cart.items) {
      const product = cartItem.productId as any;

      if (!product || !product.isActive || !product.inStock) {
        res.status(400).json({
          message: `Product unavailable: ${product?.name || 'Unknown'}`,
        });
        return;
      }

      // Clamp the requested quantity to [MOQ … min(stock, 50)]
      const clampedQty = clampQty(cartItem.quantity, product);

      if (clampedQty < 1) {
        res.status(400).json({
          message: `Insufficient stock for ${product.name}.`,
        });
        return;
      }

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: cartItem.price,
        quantity: clampedQty, // ✅ use clamped qty
        image: product.images?.[0] || '',
      });

      subtotal += cartItem.price * clampedQty; // ✅ subtotal uses clamped qty
    }

    // Calculate pricing
    const shipping = subtotal > 500 ? 0 : 50; // Free shipping above ₹500
    const tax = Math.round(subtotal * 0.18); // 18% GST
    const total = subtotal + shipping + tax;

    // Generate unique order number and payment order ID
    const orderNumber = `NK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const paymentOrderId = `PAY${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create order with correct field names from your model
    const order = new Order({
      userId: new mongoose.Types.ObjectId(userId),
      orderNumber,
      items: orderItems, // ✅ clamped quantities
      shippingAddress,
      billingAddress: billingAddress || shippingAddress, // Default to shipping if not provided
      paymentMethod,
      paymentOrderId,
      subtotal,
      tax,
      shipping,
      total, // ✅ Using 'total' as per your model, not 'totalAmount'
      status: 'pending',
      orderStatus: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'awaiting_payment',
    });

    const savedOrder = await order.save();

    // ✅ REAL-TIME STOCK DEDUCTION (use SAVED ORDER ITEMS which are clamped)
    try {
      for (const item of savedOrder.items) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.productId, stockQuantity: { $gte: item.quantity } },
          { $inc: { stockQuantity: -item.quantity } },
          { new: true }
        ).lean();

        if (!updated) {
          throw new Error(`Stock changed for an item during order save`);
        }
      }
      console.log('✅ Stock deducted successfully for order:', orderNumber);
    } catch (stockError) {
      console.error('❌ Stock deduction failed:', stockError);
      // Rollback order if stock deduction fails
      await Order.findByIdAndDelete(savedOrder._id);
      res.status(409).json({ message: 'Stock changed. Please try again.' });
      return;
    }

    // Clear user's cart
    await Cart.findOneAndDelete({ userId });

    // ✅ EMAIL AUTOMATION INTEGRATION
    let emailResults = {
      customerEmailSent: false,
      adminEmailSent: false,
      emailError: null as string | null,
    };

    try {
      console.log('📧 Starting email automation for order:', orderNumber);

      // Send order confirmation to customer
      emailResults.customerEmailSent = await EmailAutomationService.sendOrderConfirmation(
        savedOrder as any,
        savedOrder.shippingAddress.email
      );

      // Send admin notification
      emailResults.adminEmailSent = await EmailAutomationService.notifyAdminNewOrder(savedOrder as any);

      console.log('📧 Email automation results:', {
        customerEmail: emailResults.customerEmailSent,
        adminNotification: emailResults.adminEmailSent,
        orderNumber,
      });
    } catch (emailError: any) {
      console.error('❌ Email automation failed (non-blocking):', emailError);
      emailResults.emailError = emailError.message;
      // Don't fail the order if emails fail
    }

    if (req.io) {
      // Explicit interface for the user doc
      interface IUserSummary {
        _id: mongoose.Types.ObjectId;
        name?: string;
        email?: string;
      }

      let userDoc: IUserSummary | null = null;
      try {
        userDoc = await mongoose
          .model<IUserSummary>('User')
          .findById(savedOrder.userId)
          .select('name email')
          .lean()
          .exec();
      } catch {
        userDoc = null;
      }

      const userSummary = {
        _id: savedOrder.userId.toString(),
        name: userDoc?.name || savedOrder.shippingAddress?.fullName,
        email: userDoc?.email || savedOrder.shippingAddress?.email,
      };

      req.io.to('admins').emit('orderCreated', {
        _id: (savedOrder._id as mongoose.Types.ObjectId).toString(),
        orderNumber: savedOrder.orderNumber,
        // Provide a UI-ready status but also keep raw orderStatus
        status: savedOrder.status || savedOrder.orderStatus || 'pending',
        orderStatus: savedOrder.orderStatus,
        paymentMethod, // already available from req.body above
        paymentStatus: savedOrder.paymentStatus,
        total: savedOrder.total,
        items: orderItems, // [{ name, price, quantity, image }]
        userId: userSummary, // name/email for UI
        createdAt: savedOrder.createdAt,
      });
    }

    console.log('✅ Order created successfully:', orderNumber);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        _id: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        total: savedOrder.total,
        orderStatus: savedOrder.orderStatus,
        paymentStatus: savedOrder.paymentStatus,
        items: orderItems,
        emailStatus: emailResults,
      },
    });
  } catch (error: any) {
    console.error('❌ Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// ✅ GET USER ORDERS WITH PAGINATION
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    if (!req.user) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const userId = user.id;

    console.log('📋 Fetching orders for user:', userId);

    const query: any = { userId: new mongoose.Types.ObjectId(userId) };
    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('items.productId', 'name images price category')
      .lean();

    const totalCount = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalOrders: totalCount,
        hasNextPage: Number(page) < Math.ceil(totalCount / Number(limit)),
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error: any) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// ✅ GET SINGLE ORDER BY ID
export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const userId = user.id;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
      return;
    }

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate('items.productId', 'name images price category description')
      .lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    res.json({
      success: true,
      order,
    });
  } catch (error: any) {
    console.error('❌ Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// ✅ ENHANCED ORDER DETAILS WITH COMPREHENSIVE LOGGING
export const getOrderDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json({ success: false, message: 'Invalid order ID format' });
      return;
    }

    const isAdmin = !!req.user && ['admin', 'super_admin'].includes((req.user as any).role);
    const userId = (req.user as any)?.id;

    const query = isAdmin
      ? { _id: new mongoose.Types.ObjectId(orderId) }                                  // admin: no user filter
      : { _id: new mongoose.Types.ObjectId(orderId), userId: new mongoose.Types.ObjectId(userId) }; // user: scoped

    const order = await Order.findOne(query)
      .populate({
        path: 'items.productId',
        select: 'name images price category description stockQuantity'
      })
      .lean();

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found or access denied' });
      return;
    }

    const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const currentStatusIndex = statusOrder.indexOf(order.orderStatus);
    const orderProgress = currentStatusIndex >= 0 ? ((currentStatusIndex + 1) / statusOrder.length) * 100 : 0;

    res.json({
      success: true,
      order: {
        ...order,
        orderProgress,
        canCancel: ['pending', 'confirmed'].includes(order.orderStatus),
        canTrack: ['shipped', 'out_for_delivery'].includes(order.orderStatus),
        estimatedDelivery: order.estimatedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch order details' });
  }
};


// ✅ UPDATE ORDER STATUS WITH EMAIL NOTIFICATIONS
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, trackingNumber, notes, carrierName, trackingUrl } = req.body;

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    const user = req.user as AuthenticatedUser;
    if (!['admin', 'super_admin'].includes(user.role)) {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const previousStatus = order.orderStatus;

    // Guard: if already delivered/cancelled, block destructive changes
    if (['delivered', 'cancelled'].includes(previousStatus)) {
      res.status(400).json({ success: false, message: `Order already ${previousStatus}` });
      return;
    }

    // --- Transition logic ---
    // When moving to CONFIRMED for the first time: validate & deduct stock now
    const isConfirmTransition =
      status === 'confirmed' && ['pending', 'processing'].includes(previousStatus);

    if (isConfirmTransition) {
      // Validate stock before deducting
      for (const item of order.items) {
        const product = await Product.findById(item.productId).lean();
        if (!product || !product.inStock || product.stockQuantity < item.quantity) {
          res.status(400).json({
            success: false,
            message: `Insufficient stock for an item. Please refresh inventory and try again.`,
          });
          return;
        }
      }

      // Deduct stock atomically (best-effort)
      for (const item of order.items) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.productId, stockQuantity: { $gte: item.quantity } },
          { $inc: { stockQuantity: -item.quantity } },
          { new: true }
        ).lean();

        if (!updated) {
          // If any deduction fails, rollback the ones already deducted (simple compensating action)
          for (const rollback of order.items) {
            await Product.findByIdAndUpdate(rollback.productId, {
              $inc: { stockQuantity: rollback.quantity },
            });
          }
          res.status(409).json({
            success: false,
            message: 'Stock changed during confirmation. Please try again.',
          });
          return;
        }
      }
    }

    // Apply fields
    order.orderStatus = status;
    order.status = status;

    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (carrierName) order.carrierName = carrierName;
    if (trackingUrl) order.trackingUrl = trackingUrl;
    if (notes) order.notes = notes;

    // Timestamps for specific statuses
    switch (status) {
      case 'confirmed':
        // Mark paidAt if you treat confirm as post-payment control
        if (!order.paidAt && order.paymentStatus === 'paid') order.paidAt = new Date();
        break;
      case 'shipped':
        order.shippedAt = new Date();
        break;
      case 'delivered':
        order.deliveredAt = new Date();
        break;
      case 'cancelled':
        order.cancelledAt = new Date();
        break;
    }

    const updatedOrder = await order.save();

    // --- Emails ---
    let emailSent = false;
    try {
      emailSent = await EmailAutomationService.sendOrderStatusUpdate(
        updatedOrder as any,
        previousStatus
      );
    } catch (emailError: any) {
      console.error('❌ Status update email failed (non-blocking):', emailError);
    }

    // --- Socket events ---
    if (req.io) {
      // Admin dashboards
      req.io.to('admins').emit('orderStatusUpdated', {
        _id: updatedOrder._id,
        userId: updatedOrder.userId.toString(),
        orderNumber: updatedOrder.orderNumber,
        orderStatus: updatedOrder.orderStatus,
        trackingNumber: updatedOrder.trackingNumber,
        carrierName: updatedOrder.carrierName,
        trackingUrl: updatedOrder.trackingUrl,
        updatedAt: updatedOrder.updatedAt,
      });

      // Specific user
      req.io.to(updatedOrder.userId.toString()).emit('orderStatusUpdated', {
        _id: updatedOrder._id,
        userId: updatedOrder.userId.toString(),
        orderNumber: updatedOrder.orderNumber,
        orderStatus: updatedOrder.orderStatus,
        trackingNumber: updatedOrder.trackingNumber,
        carrierName: updatedOrder.carrierName,
        trackingUrl: updatedOrder.trackingUrl,
        updatedAt: updatedOrder.updatedAt,
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        _id: updatedOrder._id,
        orderNumber: updatedOrder.orderNumber,
        orderStatus: updatedOrder.orderStatus,
        trackingNumber: updatedOrder.trackingNumber,
        carrierName: updatedOrder.carrierName,
        trackingUrl: updatedOrder.trackingUrl,
        updatedAt: updatedOrder.updatedAt,
      },
      emailSent,
    });
  } catch (error: any) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ✅ GET ALL ORDERS (ADMIN FUNCTION)
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, status, paymentMethod, dateFrom, dateTo, search } = req.query;

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const user = req.user as AuthenticatedUser;

    // Check if user has admin privileges
    if (!['admin', 'super_admin'].includes(user.role)) {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    console.log('📊 Admin fetching all orders with filters:', {
      page,
      limit,
      status,
      paymentMethod,
      dateFrom,
      dateTo,
      search,
    });

    const query: any = {};

    // Apply filters
    if (status) {
      query.orderStatus = status;
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phoneNumber': { $regex: search, $options: 'i' } },
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('userId', 'name email phone')
      .populate('items.productId', 'name images category')
      .lean();

    const totalCount = await Order.countDocuments(query);

    // Calculate summary statistics
    const totalValue = orders.reduce((sum, order) => sum + order.total, 0); // ✅ Using 'total' field
    const statusCounts = await Order.aggregate([
      { $match: query },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalOrders: totalCount,
        hasNextPage: Number(page) < Math.ceil(totalCount / Number(limit)),
        hasPrevPage: Number(page) > 1,
      },
      summary: {
        totalValue,
        averageOrderValue: totalCount > 0 ? totalValue / totalCount : 0,
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error: any) {
    console.error('❌ Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ✅ CANCEL ORDER WITH EMAIL NOTIFICATION
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const userId = user.id;

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.orderStatus)) {
      res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
      return;
    }

    const previousStatus = order.orderStatus;

    // Update order status
    order.orderStatus = 'cancelled';
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.customerNotes = reason || 'Cancelled by customer'; // ✅ Using 'customerNotes' field

    // ✅ RESTORE INVENTORY (Manual implementation)
    try {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stockQuantity: item.quantity } });
      }
      console.log('✅ Stock restored for cancelled order:', order.orderNumber);
    } catch (stockError) {
      console.error('❌ Stock restoration failed:', stockError);
    }

    const cancelledOrder = await order.save();

    // ✅ EMAIL AUTOMATION FOR CANCELLATION
    let emailSent = false;
    try {
      console.log('📧 Sending cancellation email for order:', order.orderNumber);
      emailSent = await EmailAutomationService.sendOrderStatusUpdate(
        cancelledOrder as any,
        previousStatus
      );
      console.log('📧 Cancellation email result:', emailSent);
    } catch (emailError: any) {
      console.error('❌ Cancellation email failed (non-blocking):', emailError);
    }

    console.log('✅ Order cancelled by user:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId,
      reason,
      emailSent,
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        _id: cancelledOrder._id,
        orderNumber: cancelledOrder.orderNumber,
        orderStatus: cancelledOrder.orderStatus,
        cancelledAt: cancelledOrder.cancelledAt,
        customerNotes: cancelledOrder.customerNotes,
      },
      emailSent,
    });
  } catch (error: any) {
    console.error('❌ Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ✅ TRACK ORDER
export const trackOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
      return;
    }

    const order = await Order.findById(orderId)
      .populate('items.productId', 'name images')
      .lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Create tracking timeline
    const timeline = [
      {
        status: 'Order Placed',
        date: order.createdAt,
        completed: true,
        description: 'Your order has been placed successfully',
      },
      {
        status: 'Order Confirmed',
        date: order.paidAt, // ✅ Using available field
        completed: !!order.paidAt,
        description: 'Your order has been confirmed and is being processed',
      },
      {
        status: 'Shipped',
        date: order.shippedAt,
        completed: !!order.shippedAt,
        description: order.trackingNumber
          ? `Shipped with tracking: ${order.trackingNumber}`
          : 'Your order has been shipped',
      },
      {
        status: 'Delivered',
        date: order.deliveredAt,
        completed: !!order.deliveredAt,
        description: 'Your order has been delivered successfully',
      },
    ];

    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        trackingNumber: order.trackingNumber,
        carrierName: order.carrierName,
        estimatedDelivery: order.estimatedDelivery,
        items: order.items,
      },
      timeline,
    });
  } catch (error: any) {
    console.error('❌ Track order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ✅ MANUAL EMAIL TEST FUNCTION (for debugging)
export const sendTestOrderEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const user = req.user as AuthenticatedUser;

    // Admin only
    if (!['admin', 'super_admin'].includes(user.role)) {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    const order = await Order.findById(orderId);

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    console.log('📧 Manually sending test emails for order:', order.orderNumber);

    // Send both emails
    const customerEmailSent = await EmailAutomationService.sendOrderConfirmation(
      order as any,
      order.shippingAddress.email
    );
    const adminEmailSent = await EmailAutomationService.notifyAdminNewOrder(order as any);

    res.json({
      success: true,
      message: 'Test emails sent successfully',
      results: {
        customerEmailSent,
        adminEmailSent,
        orderNumber: order.orderNumber,
        customerEmail: order.shippingAddress.email,
      },
    });
  } catch (error: any) {
    console.error('❌ Manual email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email test failed',
      error: error.message,
    });
  }
};
// ADMIN: get any order by ID
export const getOrderByIdAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const role = (req.user as any).role;
    if (!['admin', 'super_admin'].includes(role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }

    const order = await Order.findById(id)
      .populate('items.productId', 'name images price category description')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (e: any) {
    console.error('Admin getOrderById error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

