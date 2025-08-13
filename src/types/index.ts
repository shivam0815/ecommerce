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
  stockQuantity?: number;
  features: string[];
  specifications: Record<string, any>; // ✅ Fixed: Complete Record type
  tags?: string[];
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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

export interface OEMInquiry {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  productCategory: string;
  quantity: number;
  customization: string;
  message: string;
  createdAt: string;
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
