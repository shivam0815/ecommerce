// src/controllers/orderController.ts - COMPLETE VERSION WITH EMAIL AUTOMATION
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order, { IOrder } from '../models/Order';
import Cart from '../models/Cart';
import Product from '../models/Product';
// import OrderProcessingService from '../services/OrderProcessingService';
// import InventoryService from '../services/InventoryService';
import EmailAutomationService from '../config/emailService';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

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

    const orderItems = [];
    let subtotal = 0;

    // Validate stock and build order items
    for (const cartItem of cart.items) {
      const product = cartItem.productId as any;
      
      if (!product.inStock || product.stockQuantity < cartItem.quantity) {
        res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Requested: ${cartItem.quantity}`
        });
        return;
      }

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: cartItem.price,
        quantity: cartItem.quantity,
        image: product.images?.[0] || ''
      });

      subtotal += cartItem.price * cartItem.quantity;
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
      items: orderItems,
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
      paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'awaiting_payment'
    });

    const savedOrder = await order.save();

    // ✅ REAL-TIME STOCK DEDUCTION (Manual implementation)
    try {
      for (const cartItem of cart.items) {
        await Product.findByIdAndUpdate(
          cartItem.productId,
          { $inc: { stockQuantity: -cartItem.quantity } }
        );
      }
      console.log('✅ Stock deducted successfully for order:', orderNumber);
    } catch (stockError) {
      console.error('❌ Stock deduction failed:', stockError);
      // Rollback order if stock deduction fails
      await Order.findByIdAndDelete(savedOrder._id);
      res.status(400).json({ message: 'Stock deduction failed. Order cancelled.' });
      return;
    }

    // Clear user's cart
    await Cart.findOneAndDelete({ userId });

    // ✅ EMAIL AUTOMATION INTEGRATION
    let emailResults = {
      customerEmailSent: false,
      adminEmailSent: false,
      emailError: null as string | null
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
        orderNumber
      });
      
    } catch (emailError: any) {
      console.error('❌ Email automation failed (non-blocking):', emailError);
      emailResults.emailError = emailError.message;
      // Don't fail the order if emails fail
    }


      if (req.io) {
      req.io.to('admins').emit('orderCreated', {
        _id: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        total: savedOrder.total,
        orderStatus: savedOrder.orderStatus,
        paymentStatus: savedOrder.paymentStatus,
        items: orderItems,
        createdAt: savedOrder.createdAt
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
        emailStatus: emailResults
      }
    });

  } catch (error: any) {
    console.error('❌ Create order error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error' 
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
        hasPrevPage: Number(page) > 1
      }
    });

  } catch (error: any) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
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
        message: 'Invalid order ID format' 
      });
      return;
    }

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(userId)
    })
    .populate('items.productId', 'name images price category description')
    .lean();

    if (!order) {
      res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
      return;
    }

    res.json({ 
      success: true,
      order 
    });

  } catch (error: any) {
    console.error('❌ Get order error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// ✅ ENHANCED ORDER DETAILS WITH COMPREHENSIVE LOGGING
export const getOrderDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    
    console.log('🔍 getOrderDetails called with orderId:', orderId);

    if (!req.user) {
      console.log('❌ User not authenticated in getOrderDetails');
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const userId = user.id;

    console.log('🔍 Fetching order details:', { orderId, userId });

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.log('❌ Invalid orderId format:', orderId);
      res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
      return;
    }

    const order = await Order.findOne({ 
      _id: new mongoose.Types.ObjectId(orderId), 
      userId: new mongoose.Types.ObjectId(userId) 
    })
    .populate({
      path: 'items.productId',
      select: 'name images price category description stockQuantity'
    })
    .lean();

    if (!order) {
      console.log('❌ Order not found:', { orderId, userId });
      res.status(404).json({
        success: false,
        message: 'Order not found or access denied'
      });
      return;
    }

    console.log('✅ Order details found:', {
      orderNumber: order.orderNumber,
      itemCount: order.items?.length || 0,
      total: order.total,
      status: order.orderStatus
    });

    // Calculate order progress
    const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const currentStatusIndex = statusOrder.indexOf(order.orderStatus);
    const orderProgress = currentStatusIndex >= 0 ? ((currentStatusIndex + 1) / statusOrder.length) * 100 : 0;

    const enhancedOrder = {
      ...order,
      orderProgress,
      canCancel: ['pending', 'confirmed'].includes(order.orderStatus),
      canTrack: ['shipped', 'out_for_delivery'].includes(order.orderStatus),
      estimatedDelivery: order.estimatedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    };

    res.json({
      success: true,
      order: enhancedOrder
    });

  } catch (error: any) {
    console.error('❌ Error fetching order details:', {
      orderId: req.params.orderId,
      userId: (req.user as AuthenticatedUser)?.id,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ UPDATE ORDER STATUS WITH EMAIL NOTIFICATIONS
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, trackingNumber, notes } = req.body;

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

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
      return;
    }

    const previousStatus = order.orderStatus;

    // Update order status
    order.orderStatus = status;
    order.status = status; // Update both status fields
    
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
      order.carrierName = req.body.carrierName || 'Standard Shipping';
    }
    
    if (notes) {
      order.notes = notes; // ✅ Using 'notes' field from your model
    }

    // Add timestamps for specific statuses
    switch (status) {
      case 'confirmed':
        if (!order.paidAt) order.paidAt = new Date();
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

    // ✅ EMAIL AUTOMATION FOR STATUS UPDATES
    let emailSent = false;
    try {
      console.log('📧 Sending status update email for order:', order.orderNumber);
      emailSent = await EmailAutomationService.sendOrderStatusUpdate(updatedOrder as any, previousStatus);
      console.log('📧 Status update email result:', emailSent);
    } catch (emailError: any) {
      console.error('❌ Status update email failed (non-blocking):', emailError);
    }






    // ✅ SOCKET.IO: Notify all admins & the specific user
if (req.io) {
  // Notify admins so their dashboard updates
  req.io.to('admins').emit('orderStatusUpdated', {
    _id: updatedOrder._id,
    orderNumber: updatedOrder.orderNumber,
    orderStatus: updatedOrder.orderStatus,
    trackingNumber: updatedOrder.trackingNumber,
    updatedAt: updatedOrder.updatedAt
  });

  // Notify the specific user
  req.io.to(updatedOrder.userId.toString()).emit('orderStatusUpdated', {
    _id: updatedOrder._id,
    orderNumber: updatedOrder.orderNumber,
    orderStatus: updatedOrder.orderStatus,
    trackingNumber: updatedOrder.trackingNumber,
    updatedAt: updatedOrder.updatedAt
  });
}


    console.log('✅ Order status updated:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      previousStatus,
      newStatus: status,
      updatedBy: user.email,
      emailSent
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        _id: updatedOrder._id,
        orderNumber: updatedOrder.orderNumber,
        orderStatus: updatedOrder.orderStatus,
        trackingNumber: updatedOrder.trackingNumber,
        updatedAt: updatedOrder.updatedAt
      },
      emailSent
    });

  } catch (error: any) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
};

// ✅ GET ALL ORDERS (ADMIN FUNCTION)
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      paymentMethod, 
      dateFrom, 
      dateTo,
      search 
    } = req.query;

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
      page, limit, status, paymentMethod, dateFrom, dateTo, search
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
        { 'shippingAddress.phoneNumber': { $regex: search, $options: 'i' } }
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
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalOrders: totalCount,
        hasNextPage: Number(page) < Math.ceil(totalCount / Number(limit)),
        hasPrevPage: Number(page) > 1
      },
      summary: {
        totalValue,
        averageOrderValue: totalCount > 0 ? totalValue / totalCount : 0,
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error: any) {
    console.error('❌ Get all orders error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
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
      userId: new mongoose.Types.ObjectId(userId)
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.orderStatus)) {
      res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
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
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQuantity: item.quantity } }
        );
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
      emailSent = await EmailAutomationService.sendOrderStatusUpdate(cancelledOrder as any, previousStatus);
      console.log('📧 Cancellation email result:', emailSent);
    } catch (emailError: any) {
      console.error('❌ Cancellation email failed (non-blocking):', emailError);
    }

    console.log('✅ Order cancelled by user:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId,
      reason,
      emailSent
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        _id: cancelledOrder._id,
        orderNumber: cancelledOrder.orderNumber,
        orderStatus: cancelledOrder.orderStatus,
        cancelledAt: cancelledOrder.cancelledAt,
        customerNotes: cancelledOrder.customerNotes
      },
      emailSent
    });

  } catch (error: any) {
    console.error('❌ Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
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
        message: 'Invalid order ID format'
      });
      return;
    }

    const order = await Order.findById(orderId)
      .populate('items.productId', 'name images')
      .lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // Create tracking timeline
    const timeline = [
      {
        status: 'Order Placed',
        date: order.createdAt,
        completed: true,
        description: 'Your order has been placed successfully'
      },
      {
        status: 'Order Confirmed',
        date: order.paidAt, // ✅ Using available field
        completed: !!order.paidAt,
        description: 'Your order has been confirmed and is being processed'
      },
      {
        status: 'Shipped',
        date: order.shippedAt,
        completed: !!order.shippedAt,
        description: order.trackingNumber ? `Shipped with tracking: ${order.trackingNumber}` : 'Your order has been shipped'
      },
      {
        status: 'Delivered',
        date: order.deliveredAt,
        completed: !!order.deliveredAt,
        description: 'Your order has been delivered successfully'
      }
    ];

    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        trackingNumber: order.trackingNumber,
        carrierName: order.carrierName,
        estimatedDelivery: order.estimatedDelivery,
        items: order.items
      },
      timeline
    });

  } catch (error: any) {
    console.error('❌ Track order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
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
        message: 'Order not found' 
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
        customerEmail: order.shippingAddress.email
      }
    });

  } catch (error: any) {
    console.error('❌ Manual email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email test failed',
      error: error.message
    });
  }
};
