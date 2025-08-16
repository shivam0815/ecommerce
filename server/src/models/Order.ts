// src/models/Order.ts - COMPLETE FIXED VERSION
import mongoose, { Document, Schema } from 'mongoose';

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  orderNumber: string; // ✅ CRITICAL: Added missing orderNumber field
  items: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
    price: number;
    name?: string; // ✅ ADD: Product name for easier tracking
    image?: string; // ✅ ADD: Product image URL
  }>;
  shippingAddress: {
    fullName: string;
    phoneNumber: string;
    email: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
  billingAddress: {
    fullName: string;
    phoneNumber: string;
    email: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
  paymentMethod: 'razorpay' | 'cod'; // ✅ REMOVED: stripe (not used)
  paymentOrderId: string;
  paymentId?: string;
  paymentSignature?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  
  // ✅ Order tracking fields
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  estimatedDelivery?: Date;
  
  // ✅ Payment status tracking
  paymentStatus: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid';
  paidAt?: Date;
  
  // ✅ Order lifecycle dates
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  
  // ✅ Additional fields for better order management
  notes?: string; // Internal notes
  customerNotes?: string; // Customer notes
  discount?: number; // Discount amount
  refundAmount?: number; // Refunded amount
  refundReason?: string; // Refund reason
  
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // ✅ CRITICAL FIX: Add the missing orderNumber field
  orderNumber: { 
    type: String, 
    required: true, 
    unique: true, // This was causing the duplicate key error
    trim: true,
    uppercase: true // ✅ Store in uppercase for consistency
  },
  
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    name: { type: String }, // ✅ ADD: Product name snapshot
    image: { type: String } // ✅ ADD: Product image snapshot
  }],
  
  shippingAddress: {
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true }
  },
  
  billingAddress: {
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true }
  },
  
  paymentMethod: { 
    type: String, 
    enum: ['razorpay', 'cod'], // ✅ SIMPLIFIED: Removed stripe
    required: true 
  },
  
  paymentOrderId: { type: String, required: true, trim: true },
  paymentId: { type: String, trim: true },
  paymentSignature: { type: String, trim: true },
  
  // ✅ Financial fields with validation
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  shipping: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  discount: { type: Number, min: 0, default: 0 },
  
  // ✅ Order status tracking
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  orderStatus: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // ✅ Shipping and tracking
  trackingNumber: { type: String, trim: true, uppercase: true },
  trackingUrl: { type: String, trim: true },
  carrierName: { type: String, trim: true },
  estimatedDelivery: { type: Date },
  
  // ✅ Payment status
  paymentStatus: { 
    type: String, 
    enum: ['awaiting_payment', 'paid', 'failed', 'cod_pending', 'cod_paid'],
    default: 'awaiting_payment'
  },
  
  // ✅ Important dates
  paidAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  
  // ✅ Additional fields
  notes: { type: String, trim: true }, // Internal notes
  customerNotes: { type: String, trim: true }, // Customer notes
  refundAmount: { type: Number, min: 0, default: 0 },
  refundReason: { type: String, trim: true }
  
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true }, // Include virtuals in JSON output
  toObject: { virtuals: true }
});

// ✅ ENHANCED: Virtual fields
orderSchema.virtual('displayOrderNumber').get(function() {
  return this.orderNumber || `ORD-${this.id.toString().slice(-8).toUpperCase()}`;
});

orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.virtual('orderAge').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Days
});

orderSchema.virtual('isDelivered').get(function() {
  return this.status === 'delivered' || this.orderStatus === 'delivered';
});

orderSchema.virtual('isPaid').get(function() {
  return this.paymentStatus === 'paid' || this.paymentStatus === 'cod_paid';
});

// ✅ ENHANCED: Indexes for optimal performance
orderSchema.index({ userId: 1, createdAt: -1 }); // User's orders by date
orderSchema.index({ orderNumber: 1 }); // ✅ CRITICAL: Unique order number lookup
orderSchema.index({ paymentOrderId: 1 }); // Payment integration lookup
orderSchema.index({ status: 1, createdAt: -1 }); // Status-based queries
orderSchema.index({ orderStatus: 1, createdAt: -1 }); // Order status queries
orderSchema.index({ paymentStatus: 1 }); // Payment status queries
orderSchema.index({ trackingNumber: 1 }); // Tracking lookup
orderSchema.index({ 'shippingAddress.pincode': 1 }); // Delivery routing
orderSchema.index({ 'shippingAddress.city': 1 }); // City-based queries
orderSchema.index({ paymentMethod: 1, createdAt: -1 }); // Payment method analytics
orderSchema.index({ total: -1 }); // High-value order queries

// ✅ ENHANCED: Pre-save middleware
orderSchema.pre('save', function(next) {
  // Auto-generate order number if not provided
  if (!this.orderNumber) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD${timestamp}${random}`;
  }
  
  // Ensure billing address defaults to shipping address
  if (!this.billingAddress || Object.keys(this.billingAddress).length === 0) {
    this.billingAddress = this.shippingAddress;
  }
  
  // Update timestamps
  if (this.isNew) {
    this.createdAt = new Date();
  }
  this.updatedAt = new Date();
  
  next();
});

// ✅ ENHANCED: Instance methods
orderSchema.methods.updateStatus = function(newStatus: string, updateDate: boolean = true) {
  this.status = newStatus;
  this.orderStatus = newStatus;
  
  if (updateDate) {
    const now = new Date();
    switch (newStatus) {
      case 'shipped':
        this.shippedAt = now;
        break;
      case 'delivered':
        this.deliveredAt = now;
        break;
      case 'cancelled':
        this.cancelledAt = now;
        break;
    }
  }
  
  this.updatedAt = new Date();
  return this.save();
};

// ✅ Replace the whole method with this
orderSchema.methods.updatePaymentStatus = function (newPaymentStatus: string) {
  this.paymentStatus = newPaymentStatus;

  if (newPaymentStatus === 'paid' || newPaymentStatus === 'cod_paid') {
    this.paidAt = new Date();

    // ⛔ Do NOT auto-confirm here.
    // Professional ecommerce keeps the order in 'pending' (or 'processing')
    // until an admin (or automated OMS rule) confirms inventory & risk checks.
    if (this.status === 'pending') {
      // optional: move to 'processing' to indicate "paid, awaiting confirmation"
      this.status = 'processing';
      this.orderStatus = 'processing';
    }
  }

  this.updatedAt = new Date();
  return this.save();
};


// ✅ ENHANCED: Static methods
orderSchema.statics.findByOrderNumber = function(orderNumber: string) {
  return this.findOne({ orderNumber: orderNumber.toUpperCase() });
};

orderSchema.statics.findByTrackingNumber = function(trackingNumber: string) {
  return this.findOne({ trackingNumber: trackingNumber.toUpperCase() });
};

orderSchema.statics.getUserOrders = function(userId: string, limit: number = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('items.productId');
};


// ✅ Add this helper under your other instance methods
// orderSchema.methods.adminConfirm = function (meta: { adminId: string; trackingNumber?: string; carrierName?: string; trackingUrl?: string } = {}) {
//   this.status = 'confirmed';
//   this.orderStatus = 'confirmed';

//   if (meta.trackingNumber) this.trackingNumber = meta.trackingNumber.toUpperCase();
//   if (meta.carrierName) this.carrierName = meta.carrierName;
//   if (meta.trackingUrl) this.trackingUrl = meta.trackingUrl;

//   this.updatedAt = new Date();
//   return this.save();
// };



export default mongoose.model<IOrder>('Order', orderSchema);
