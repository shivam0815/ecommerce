// backend/src/models/Order.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

/* ------------------------------------------------------------------ */
/* Interfaces                                                          */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "razorpay" | "cod";
export type PaymentStatus = "awaiting_payment" | "paid" | "failed" | "cod_pending" | "cod_paid";

export type ShiprocketState =
  | "ORDER_CREATED"
  | "AWB_ASSIGNED"
  | "PICKUP_GENERATED"
  | "LABEL_READY"
  | "INVOICE_READY"
  | "MANIFEST_READY"
  | "TRACKING_UPDATED";

export interface IOrderItem {
  productId: Types.ObjectId;
  quantity: number;
  price: number;
  name?: string;
  image?: string;
}

export interface IAddress {
  fullName: string;
  phoneNumber: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface IOrder extends Document {
  userId: Types.ObjectId;
  orderNumber: string;

  items: IOrderItem[];

  shippingAddress: IAddress;
  billingAddress: IAddress;

  paymentMethod: PaymentMethod;
  paymentOrderId: string;
  paymentId?: string;
  paymentSignature?: string;

  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  discount?: number;

  // Legacy/top-level status (kept for UI compatibility)
  status: OrderStatus;

  // Canonical order status (mirrors status)
  orderStatus: OrderStatus;

  // Tracking
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  estimatedDelivery?: Date;

  // Payment status
  paymentStatus: PaymentStatus;
  paidAt?: Date;

  // Order lifecycle dates
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;

  // Notes & refunds
  notes?: string;
  customerNotes?: string;
  refundAmount?: number;
  refundReason?: string;

  // Shiprocket integration
  shipmentId?: number;
  awbCode?: string;
  courierName?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  manifestUrl?: string;
  shiprocketStatus?: ShiprocketState;

  // Auto timestamps
  createdAt: Date;
  updatedAt: Date;

  // Virtuals (ts won’t see them, but we document)
  // displayOrderNumber?: string;
  // totalItems?: number;
  // orderAge?: number;
  // isDelivered?: boolean;
  // isPaid?: boolean;
}

/** Instance methods */
export interface IOrderMethods {
  updateStatus(newStatus: OrderStatus, updateDate?: boolean): Promise<IOrder>;
  updatePaymentStatus(newPaymentStatus: PaymentStatus): Promise<IOrder>;

  // Shiprocket helpers
  attachShiprocketOrder(shipmentId: number): Promise<IOrder>;
  setAwb(opts: { awbCode: string; courierName?: string }): Promise<IOrder>;
  markPickupGenerated(): Promise<IOrder>;
  setLabelUrl(url: string): Promise<IOrder>;
  setInvoiceUrl(url: string): Promise<IOrder>;
  setManifestUrl(url: string): Promise<IOrder>;
  updateTrackingFromAwb(opts: {
    awbCode?: string;
    carrierName?: string;
    trackingUrl?: string;
    estimatedDelivery?: Date | string;
  }): Promise<IOrder>;
}

/** Static methods */
export interface IOrderModel extends Model<IOrder, {}, IOrderMethods> {
  findByOrderNumber(orderNumber: string): Promise<IOrder | null>;
  findByTrackingNumber(trackingNumber: string): Promise<IOrder | null>;
  getUserOrders(userId: string, limit?: number): Promise<IOrder[]>;
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    name: { type: String },
    image: { type: String },
  },
  { _id: false }
);

const AddressSchema = new Schema<IAddress>(
  {
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder, IOrderModel, IOrderMethods>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    items: { type: [OrderItemSchema], required: true },

    shippingAddress: { type: AddressSchema, required: true },
    billingAddress: { type: AddressSchema, required: true },

    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod"],
      required: true,
    },
    paymentOrderId: { type: String, required: true, trim: true },
    paymentId: { type: String, trim: true },
    paymentSignature: { type: String, trim: true },

    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, default: 0 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    trackingNumber: { type: String, trim: true, uppercase: true },
    trackingUrl: { type: String, trim: true },
    carrierName: { type: String, trim: true },
    estimatedDelivery: { type: Date },

    paymentStatus: {
      type: String,
      enum: ["awaiting_payment", "paid", "failed", "cod_pending", "cod_paid"],
      default: "awaiting_payment",
    },
    paidAt: { type: Date },

    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },

    notes: { type: String, trim: true },
    customerNotes: { type: String, trim: true },
    refundAmount: { type: Number, min: 0, default: 0 },
    refundReason: { type: String, trim: true },

    // Shiprocket integration
    shipmentId: { type: Number, index: true },
    awbCode: { type: String, trim: true, uppercase: true, index: true },
    courierName: { type: String, trim: true },
    labelUrl: { type: String, trim: true },
    invoiceUrl: { type: String, trim: true },
    manifestUrl: { type: String, trim: true },
    shiprocketStatus: {
      type: String,
      enum: [
        "ORDER_CREATED",
        "AWB_ASSIGNED",
        "PICKUP_GENERATED",
        "LABEL_READY",
        "INVOICE_READY",
        "MANIFEST_READY",
        "TRACKING_UPDATED",
      ],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------------------------------------------------------------ */
/* Virtuals                                                            */
/* ------------------------------------------------------------------ */

OrderSchema.virtual("displayOrderNumber").get(function (this: IOrder) {
  return this.orderNumber || `ORD-${this.id.toString().slice(-8).toUpperCase()}`;
});

OrderSchema.virtual("totalItems").get(function (this: IOrder) {
  return (this.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
});

OrderSchema.virtual("orderAge").get(function (this: IOrder) {
  const now = Date.now();
  const created = new Date(this.createdAt).getTime();
  return Math.ceil(Math.abs(now - created) / (1000 * 60 * 60 * 24));
});

OrderSchema.virtual("isDelivered").get(function (this: IOrder) {
  return this.status === "delivered" || this.orderStatus === "delivered";
});

OrderSchema.virtual("isPaid").get(function (this: IOrder) {
  return this.paymentStatus === "paid" || this.paymentStatus === "cod_paid";
});

/* ------------------------------------------------------------------ */
/* Indexes                                                             */
/* ------------------------------------------------------------------ */

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ paymentOrderId: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ trackingNumber: 1 });
OrderSchema.index({ "shippingAddress.pincode": 1 });
OrderSchema.index({ "shippingAddress.city": 1 });
OrderSchema.index({ paymentMethod: 1, createdAt: -1 });
OrderSchema.index({ total: -1 });
// Shiprocket-specific:
OrderSchema.index({ shipmentId: 1 });
OrderSchema.index({ awbCode: 1 });

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

OrderSchema.pre<IOrder>("save", function (next) {
  // Auto-generate order number if not provided
  if (!this.orderNumber) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    this.orderNumber = `ORD${timestamp}${random}`.toUpperCase();
  }

  // Ensure billing defaults to shipping if missing
  if (!this.billingAddress || Object.keys(this.billingAddress as any).length === 0) {
    this.billingAddress = this.shippingAddress;
  }

  this.updatedAt = new Date();
  if (this.isNew) this.createdAt = new Date();

  next();
});

/* ------------------------------------------------------------------ */
/* Instance methods                                                    */
/* ------------------------------------------------------------------ */

OrderSchema.methods.updateStatus = function (
  this: IOrder,
  newStatus: OrderStatus,
  updateDate: boolean = true
) {
  this.status = newStatus;
  this.orderStatus = newStatus;

  if (updateDate) {
    const now = new Date();
    switch (newStatus) {
      case "shipped":
        this.shippedAt = now;
        break;
      case "delivered":
        this.deliveredAt = now;
        break;
      case "cancelled":
        this.cancelledAt = now;
        break;
    }
  }

  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.updatePaymentStatus = function (this: IOrder, newPaymentStatus: PaymentStatus) {
  this.paymentStatus = newPaymentStatus;

  if (newPaymentStatus === "paid" || newPaymentStatus === "cod_paid") {
    this.paidAt = new Date();
    // keep business control — move to processing if pending
    if (this.status === "pending") {
      this.status = "processing";
      this.orderStatus = "processing";
    }
  }

  this.updatedAt = new Date();
  return this.save();
};

// --- Shiprocket helpers ---

OrderSchema.methods.attachShiprocketOrder = function (this: IOrder, shipmentId: number) {
  this.shipmentId = shipmentId;
  this.shiprocketStatus = "ORDER_CREATED";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.setAwb = function (
  this: IOrder,
  opts: { awbCode: string; courierName?: string }
) {
  this.awbCode = (opts.awbCode || "").toUpperCase();
  if (opts.courierName) this.courierName = opts.courierName;
  this.trackingNumber = this.awbCode;
  this.shiprocketStatus = "AWB_ASSIGNED";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.markPickupGenerated = function (this: IOrder) {
  this.shiprocketStatus = "PICKUP_GENERATED";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.setLabelUrl = function (this: IOrder, url: string) {
  this.labelUrl = url;
  this.shiprocketStatus = "LABEL_READY";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.setInvoiceUrl = function (this: IOrder, url: string) {
  this.invoiceUrl = url;
  this.shiprocketStatus = "INVOICE_READY";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.setManifestUrl = function (this: IOrder, url: string) {
  this.manifestUrl = url;
  this.shiprocketStatus = "MANIFEST_READY";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.updateTrackingFromAwb = function (
  this: IOrder,
  opts: { awbCode?: string; carrierName?: string; trackingUrl?: string; estimatedDelivery?: Date | string }
) {
  if (opts.awbCode) this.awbCode = String(opts.awbCode).toUpperCase();
  if (opts.carrierName) this.courierName = opts.carrierName;
  if (opts.trackingUrl) this.trackingUrl = opts.trackingUrl;
  if (opts.estimatedDelivery) this.estimatedDelivery = new Date(opts.estimatedDelivery);
  this.shiprocketStatus = "TRACKING_UPDATED";
  this.updatedAt = new Date();
  return this.save();
};

/* ------------------------------------------------------------------ */
/* Statics                                                             */
/* ------------------------------------------------------------------ */

OrderSchema.statics.findByOrderNumber = function (
  this: IOrderModel,
  orderNumber: string
) {
  return this.findOne({ orderNumber: orderNumber.toUpperCase() });
};

OrderSchema.statics.findByTrackingNumber = function (
  this: IOrderModel,
  trackingNumber: string
) {
  return this.findOne({ trackingNumber: trackingNumber.toUpperCase() });
};

OrderSchema.statics.getUserOrders = function (
  this: IOrderModel,
  userId: string,
  limit: number = 20
) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("items.productId");
};

/* ------------------------------------------------------------------ */
/* Model export (guard against OverwriteModelError in dev)             */
/* ------------------------------------------------------------------ */

const Order =
  (mongoose.models.Order as IOrderModel) ||
  mongoose.model<IOrder, IOrderModel>("Order", OrderSchema);

export default Order;
