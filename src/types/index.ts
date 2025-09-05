// src/types/index.ts - COMPLETE FIXED VERSION
import { Types, Document } from 'mongoose';
import { Request } from 'express';

// ✅ FIXED: Complete Product interface matching ProductCard usage
export interface Product {
  brand?: any;
  _id?: string;
  id?: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  images: string[];
  image?: string;
  primaryImage?: string;
  imageUrl?: string;
  thumbnail?: string;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  currency:string;
  stockQuantity?: number;
  features: string[];
  specifications: Record<string, any>; // ✅ Fixed: Complete Record type
  tags?: string[];
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  compareAtPrice?: number | null; 
}

// ✅ FIXED: Complete CartItem interface
export interface CartItem {
  product: string;
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  images?: string[];
  image?: string;
  category?: string;
  originalPrice?: number;
  totalPrice?: number;
}

// ✅ FIXED: Complete User interface
export interface User {
  token?: any;
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: Address;
  isVerified?: boolean;
  twoFactorEnabled?: boolean;
  role: 'user' | 'admin';
} // ✅ Added closing brace

export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
} // ✅ Added closing brace

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: Address;
  paymentMethod: string;
  createdAt: string;
}

export type OEMStatus =
  | 'pending'
  | 'contacted'
  | 'quoted'
  | 'closed';

export type OEMCategory =
  | 'TWS'
  | 'Bluetooth Neckbands'
  | 'Data Cables'
  | 'Mobile Chargers'
  | 'Mobile ICs'
  | 'Mobile Repairing Tools'
  | 'Car Charger'
  | 'Bluetooth Speaker'
  | 'Power Bank'
  | 'Custom'; // backend normalizes "Custom Product" -> "Custom"

export interface OEMInquiry {
  id: string;        // FE-normalized id
  _id?: string;      // sometimes BE returns _id; keep optional to be safe
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  productCategory: OEMCategory;
  quantity: number;
  customization: string;
  message?: string;
  status: OEMStatus; // <-- add this
  createdAt: string;
  updatedAt?: string;
}
// ✅ FIXED: Database interfaces with proper syntax
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'user' | 'admin';
  address?: Address;
  isVerified: boolean;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  images: string[];
  rating: number;
  reviews: number;
  inStock: boolean;
  stockQuantity: number;
  features: string[];
  specifications: Record<string, any>;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
   isOnSale?: boolean;
  views?: number;
  brand?: string;
  stock?: number;
}

export interface ICart extends Document {
  userId: Types.ObjectId;
  items: {
    productId: Types.ObjectId;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ✅ FIXED: Complete Order interface with proper syntax
export interface IOrder extends Document {
  userId: Types.ObjectId;
  orderNumber?: string;
  items: Array<{ // ✅ Fixed: Proper TypeScript syntax
    productId: Types.ObjectId;
    name?: string;
    quantity: number;
    price: number;
    image?: string;
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
    country?: string;
  };
  billingAddress?: {
    fullName: string;
    phoneNumber: string;
    email: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    country?: string;
  };
  paymentMethod: 'razorpay' | 'stripe' | 'cod';
  paymentOrderId: string;
  paymentId?: string;
  paymentSignature?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  totalAmount: number;
  paymentStatus: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid' | 'pending' | 'completed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOEMInquiry extends Document {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  productCategory: string;
  quantity: number;
  customization: string;
  message: string;
  status: 'pending' | 'contacted' | 'quoted' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  
}

export interface IReview extends Document {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  rating: number;
  comment: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  id: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
    phone?: string;
    _id?: string;
    isVerified?: boolean;
    status?: string;
  };
}

// ✅ FIXED: Complete PaymentOrderData interface
export interface PaymentOrderData {
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: IOrder['shippingAddress'];
  billingAddress?: IOrder['billingAddress'];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export interface AdminStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalUsers: number;
  lowStockItems: Array<{
    productId: string;
    name: string;
    stockQuantity: number;
  }>;
}
// frontend/src/types/index.ts
// Your existing types...

// Admin Dashboard Types (without Document extension)
export interface ReturnedProduct {
  _id?: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  userEmail: string;
  returnReason: string;
  returnDate: Date;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  refundAmount: number;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Review {
  _id?: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  reviewDate: Date;
  helpful: number;
  verified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Payment {
  _id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  transactionId: string;
  paymentDate: Date;
  orderId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Frontend-specific types
export type ReturnStatus = 'all' | 'pending' | 'approved' | 'rejected';
export type PaymentStatusFilter = 'all' | 'completed' | 'pending' | 'failed';
export type DateFilter = 'today' | 'weekly' | 'monthly' | 'all';

export interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  completedPayments: number;
  failedPayments: number;
  pendingPayments: number;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }>;
}

export interface QualityAssessment {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}
export type Language = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu';

export interface UserPrefs {
  notifications: boolean;
  theme: 'light' | 'dark';
  language: Language;
}
