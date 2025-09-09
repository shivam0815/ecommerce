// src/controllers/paymentController.ts - COMPLETE FIXED VERSION
import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { PaymentOrderData } from '../types';
import Order from '../models/Order';
import Cart from '../models/Cart';
import Payment from '../models/Payment';
import { decrementStockForOrder } from '../services/inventory.service'; 
import { startOfDay, endOfDay } from 'date-fns';

// ✅ Define the authenticated user type
interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
  isVerified?: boolean;
  twoFactorEnabled?: boolean;
}

// ✅ Initialize Razorpay with error handling
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ✅ CRITICAL FIX: Generate unique order number
const generateOrderNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
};

export const createPaymentOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { amount, currency = 'INR', paymentMethod, orderData } = req.body;
    const user = req.user as AuthenticatedUser;

    console.log('🔍 Creating payment order:', {
      userId: user?.id,
      amount,
      paymentMethod,
      hasOrderData: !!orderData,
      timestamp: new Date().toISOString()
    });

    // ✅ Check environment variables first
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('❌ Missing Razorpay environment variables');
      res.status(500).json({
        success: false,
        message: 'Payment gateway configuration error'
      });
      return;
    }

    // ✅ Validate user authentication
    if (!user) {
      console.error('❌ User not authenticated');
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // ✅ Validate amount
    if (!amount || amount <= 0) {
      console.error('❌ Invalid amount:', amount);
      res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
      return;
    }

    // ✅ Validate orderData
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      console.error('❌ Invalid order data');
      res.status(400).json({
        success: false,
        message: 'Invalid order data - items are required'
      });
      return;
    }

    // ✅ Validate shipping address
    if (!orderData.shippingAddress) {
      console.error('❌ Missing shipping address');
      res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
      return;
    }

    let paymentOrderId: string;

    switch (paymentMethod) {
      case 'razorpay':
        console.log('💳 Creating Razorpay order...');
        
        try {
          // ✅ CRITICAL FIX: Generate shorter receipt (max 40 chars)
          const timestamp = Date.now().toString().slice(-8); // Last 8 digits
          const userIdShort = user.id.slice(-8); // Last 8 chars of user ID
          const shortReceipt = `ord_${timestamp}_${userIdShort}`; // 21 chars total
          
          console.log('📋 Receipt generated:', shortReceipt, `(${shortReceipt.length} chars)`);

          // ✅ Validate receipt length (Razorpay max: 40 chars)
          if (shortReceipt.length > 40) {
            throw new Error(`Receipt too long: ${shortReceipt.length} chars (max 40)`);
          }

          const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(amount * 100), // Convert to paise
            currency,
            receipt: shortReceipt, // ✅ FIXED: Now under 40 chars
            notes: {
              userId: user.id,
              orderType: 'product_purchase',
              itemCount: orderData.items.length,
              customerEmail: user.email || 'unknown',
              fullTimestamp: Date.now().toString() // Store full timestamp in notes
            }
          });
          
          console.log('✅ Razorpay order created:', razorpayOrder.id);
          paymentOrderId = razorpayOrder.id;
        } catch (razorpayError: any) {
          console.error('❌ Razorpay order creation failed:', {
            error: razorpayError.message,
            statusCode: razorpayError.statusCode,
            details: razorpayError.error || razorpayError
          });
          res.status(500).json({
            success: false,
            message: 'Failed to create Razorpay order',
            error: razorpayError.message || 'Razorpay API error'
          });
          return;
        }
        break;

      case 'cod':
        console.log('💰 Creating COD order...');
        const timestamp = Date.now().toString().slice(-8);
        const userIdShort = user.id.slice(-8);
        paymentOrderId = `cod_${timestamp}_${userIdShort}`; // Consistent format
        break;

      default:
        console.error('❌ Invalid payment method:', paymentMethod);
        res.status(400).json({
          success: false,
          message: 'Invalid payment method. Supported: razorpay, cod'
        });
        return;
    }

    // ✅ CRITICAL FIX: Generate unique order number to fix duplicate key error
    const orderNumber = generateOrderNumber();
    console.log('🔢 Generated order number:', orderNumber);

    // ✅ Create order in database
    console.log('💾 Creating database order...');
    
    const order = new Order({
      userId: user.id,
      orderNumber: orderNumber, // ✅ ADDED: Unique order number
      items: orderData.items,
      shippingAddress: orderData.shippingAddress,
      billingAddress: orderData.billingAddress || orderData.shippingAddress,
      paymentMethod,
      paymentOrderId,
      subtotal: orderData.subtotal || 0,
      tax: orderData.tax || 0,
      shipping: orderData.shipping || 0,
      total: amount, // ✅ FIXED: Use 'total' not 'totalAmount'
      status: 'pending', // ✅ ADDED: status field
      orderStatus: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'awaiting_payment',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await order.save();
    console.log('✅ Order created in database with orderNumber:', order.orderNumber);

    res.json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber, // ✅ Include in response
      paymentOrderId,
      amount,
      currency,
      paymentMethod,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID, // ✅ For frontend
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        items: order.items
      }
    });

  } catch (error: any) {
    console.error('❌ Payment order creation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// In your paymentController.ts - CRITICAL FIX
export const verifyPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { paymentId, orderId, signature, paymentMethod } = req.body;
    const user = req.user as AuthenticatedUser;

    console.log('🔍 Verifying payment:', {
      paymentId,
      orderId,
      paymentMethod,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    // ✅ Validate required fields
    if (!paymentId || !orderId || !paymentMethod) {
      res.status(400).json({ success: false, message: 'Missing required payment verification data' });
      return;
    }

    let paymentVerified = false;

    switch (paymentMethod) {
      case 'razorpay':
        if (!signature) {
          res.status(400).json({ success: false, message: 'Payment signature is required for Razorpay' });
          return;
        }
        const body = orderId + '|' + paymentId;
        const expectedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
          .update(body.toString())
          .digest('hex');

        paymentVerified = expectedSignature === signature;
        console.log('🔐 Razorpay signature verification:', { verified: paymentVerified });
        break;

      case 'cod':
        paymentVerified = true;
        console.log('💰 COD payment auto-verified');
        break;

      default:
        res.status(400).json({ success: false, message: 'Invalid payment method for verification' });
        return;
    }

    if (paymentVerified) {
      // ✅ Find order by paymentOrderId
      const order = await Order.findOne({ paymentOrderId: orderId });
      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found' });
        return;
      }

      // ✅ Check ownership
      if (!order.userId.equals(user.id)) {
        res.status(403).json({ success: false, message: 'Unauthorized access to order' });
        return;
      }

      // ✅ Update order
      order.paymentStatus = paymentMethod === 'cod' ? 'cod_pending' : 'paid';
      order.orderStatus = 'confirmed';
      order.status = 'confirmed';
      order.paymentId = paymentId;
      order.paymentSignature = signature;
      order.paidAt = new Date();
      order.updatedAt = new Date();
      await order.save();

      console.log('✅ Order updated:', { orderNumber: order.orderNumber });

      // ✅ Create / update Payment record
      await Payment.findOneAndUpdate(
        { transactionId: paymentId },
        {
          userId: user.id,
          userName: user.name || '',
          userEmail: user.email || '',
          amount: order.total,
          paymentMethod,
          status: 'completed',
          transactionId: paymentId,
          orderId: order.id.toString(),
          paymentDate: new Date()
        },
        { upsert: true, new: true }
      );
    

      // ✅ Clear cart
      try {
        await Cart.findOneAndDelete({ userId: user.id });
        console.log('🛒 Cart cleared successfully');
      } catch (cartError) {
        console.error('⚠️ Cart clearing failed:', cartError);
      }

      // ✅ Response
      const populatedOrder = await Order.findById(order._id).populate('items.productId');
      res.json({
        success: true,
        message: 'Payment verified and order confirmed! 🎉',
        order: populatedOrder,
        paymentDetails: {
          paymentId,
          paymentMethod,
          amount: order.total,
          paidAt: order.paidAt
        }
      });

    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed. Please try again or contact support.' });
    }

  } catch (error: any) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
};


export const getPaymentStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const user = req.user as AuthenticatedUser;

    console.log('📊 Getting payment status:', {
      orderId,
      userId: user?.id
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
      return;
    }

    const order = await Order.findById(orderId).populate('items.productId');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }

    // ✅ FIXED: Correct authorization logic (! added)
    if (!order.userId.equals(user.id)) {
      console.error('❌ Unauthorized order access in getPaymentStatus');
      res.status(403).json({
        success: false,
        message: 'Unauthorized access to order'
      });
      return;
    }

    res.json({
      success: true,
      order,
      status: {
        payment: order.paymentStatus,
        order: order.orderStatus,
        total: order.total,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        paidAt: order.paidAt
      }
    });

  } catch (error: any) {
    console.error('❌ Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment status'
    });
  }
};

// ✅ BONUS: Add helper function for receipt generation
export const generateShortReceipt = (prefix: string, userId: string): string => {
  const timestamp = Date.now().toString().slice(-8);
  const userIdShort = userId.slice(-8);
  const receipt = `${prefix}_${timestamp}_${userIdShort}`;
  
  // Validate length
  if (receipt.length > 40) {
    throw new Error(`Receipt too long: ${receipt.length} chars (max 40)`);
  }
  
  return receipt;
};
export const getTodayPaymentsSummary = async (req: Request, res: Response) => {
  try {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());

    const payments = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          paymentDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const todayList = await Payment.find({
      status: 'completed',
      paymentDate: { $gte: start, $lte: end }
    }).sort({ paymentDate: -1 });

    res.json({
      success: true,
      totalAmount: payments[0]?.totalAmount || 0,
      count: payments[0]?.count || 0,
      transactions: todayList
    });
  } catch (err: any) {
    console.error('❌ Error in getTodayPaymentsSummary:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const payments = await Payment.find().sort({ paymentDate: -1 });
    res.json({ success: true, data: payments });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};