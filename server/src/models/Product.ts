// src/models/Product.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  brand: string;
  images: string[];
  rating: number;
  reviews: number;
  inStock: boolean;
  stockQuantity: number;
  features: string[];
  // allow any JSON (arrays, numbers, booleans, nested objects)
  specifications: Map<string, any> | Record<string, any>;
  tags: string[];
  isActive: boolean;
  status: 'active' | 'inactive' | 'draft';
  businessName?: string;
  createdAt: Date;
  updatedAt: Date;
  averageRating?: number;
  ratingsCount?: number;
    compareAtPrice?: number | null; 

  // 🆕 New fields
  sku?: string; // product id
  color?: string;
  ports?: number;
  warrantyPeriodMonths?: number;
  warrantyType?: 'Manufacturer' | 'Seller' | 'No Warranty';
  manufacturingDetails?: Record<string, any>;

  // admin-only
  gst?: number;
  hsnCode?: string;
  netWeight?: number;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'TWS',
          'Bluetooth Neckbands',
          'Data Cables',
          'Mobile Chargers',
          'Mobile ICs',
          'Mobile Repairing Tools',
          'Electronics',
          'Accessories',
          'Car Chargers',
          'Bluetooth Speakers',
          'Power Banks',
          'Others',
        ],
        message: '{VALUE} is not a valid category',
      },
    },
    subcategory: String,
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      default: 'Nakoda',
    },
    images: {
      type: [String],
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be more than 5'],
    },
    reviews: {
      type: Number,
      default: 0,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
    },
    features: {
      type: [String],
      default: [],
    },

    // 🔧 THE IMPORTANT FIX:
    specifications: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    compareAtPrice: { type: Number, default: null },

    tags: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'active',
    },
    businessName: String,

    // Optional aggregate fields
    averageRating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },

    // 🆕 New fields
    sku: { type: String, trim: true, index: true },
    color: { type: String, trim: true },
    ports: { type: Number, min: 0, default: 0 },
    warrantyPeriodMonths: { type: Number, min: 0, default: 0 },
    warrantyType: {
      type: String,
      enum: ['Manufacturer', 'Seller', 'No Warranty'],
      default: 'No Warranty',
    },
    manufacturingDetails: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // 🆕 Admin-only
    gst: { type: Number, min: 0, max: 100, select: false },
    hsnCode: { type: String, trim: true, select: false },
    netWeight: { type: Number, min: 0, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        if (ret.specifications instanceof Map) {
          ret.specifications = Object.fromEntries(ret.specifications);
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        if (ret.specifications instanceof Map) {
          ret.specifications = Object.fromEntries(ret.specifications);
        }
        return ret;
      },
    },
  }
);

// Indexes
productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ isActive: 1, inStock: 1, status: 1 });
productSchema.index({ createdAt: -1 });

// Keep inStock in sync
productSchema.pre('save', function (next) {
  // @ts-ignore
  this.inStock = (this.stockQuantity || 0) > 0;
  next();
});


export default mongoose.model<IProduct>('Product', productSchema);
