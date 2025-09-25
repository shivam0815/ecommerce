// src/models/Product.ts
import mongoose, { Schema, Document } from 'mongoose';

/* ────────────────────────────────────────────────────────────── */
/* Types */
export type PricingTier = {
  minQty: number;     // e.g., 10, 50, 100, 150
  unitPrice: number;  // INR per piece (use paise if you prefer integers)
};

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;

  // Core
  name: string;
  description: string;
  price: number;                 // base/fallback unit price
  originalPrice?: number;
  category: string;
  subcategory?: string;
  brand: string;
  images: string[];

  // Ratings
  rating: number;
  reviews: number;
  averageRating?: number;
  ratingsCount?: number;

  // Inventory
  inStock: boolean;
  stockQuantity: number;

  // Merchandising
  features: string[];
  specifications: Map<string, any> | Record<string, any>;
  tags: string[];
  isActive: boolean;
  status: 'active' | 'inactive' | 'draft';
  businessName?: string;
  compareAtPrice?: number | null;

  // Meta
  createdAt: Date;
  updatedAt: Date;

  // Extras
  sku?: string;
  color?: string;
  ports?: number;
  warrantyPeriodMonths?: number;
  warrantyType?: 'Manufacturer' | 'Seller' | 'No Warranty';
  manufacturingDetails?: Record<string, any>;

  // Admin-only
  gst?: number;
  hsnCode?: string;
  netWeight?: number;

  // MOQ
  minOrderQtyOverride?: number | null; // per-product override
  // virtual (getter only)
  // @ts-ignore
  minOrderQty?: number;

  // Bulk pricing
  pricingTiers: PricingTier[];   // sorted ASC by minQty
  packSize?: number | null;      // enforce multiples (e.g., 10). 1/null => off
  incrementStep?: number | null; // enforce step increments (e.g., +10). 1/null => off

  // Methods
  getUnitPriceForQty?(qty: number): number;
}

/* ────────────────────────────────────────────────────────────── */
/** Category-wise MOQ defaults (ALL = 10) */
export const CATEGORY_MOQ: Record<string, number> = {
  'Car Chargers': 10,
  'Bluetooth Neckbands': 10,
  'TWS': 10,
  'Data Cables': 10,
  'Mobile Chargers': 10,
  'Integrated Circuits & Chips': 10,
  'Mobile Repairing Tools': 10,
  'Electronics': 10,
  'Accessories': 10,
  'Bluetooth Speakers': 10,
  'Power Banks': 10,
  'Others': 10,
};

/* ────────────────────────────────────────────────────────────── */
/** Sub-schema for tiers */
const PricingTierSchema = new Schema<PricingTier>(
  {
    minQty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

/* ────────────────────────────────────────────────────────────── */
/** Product schema */
const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [10000, 'Product name cannot exceed 10000 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      maxlength: [40000, 'Description cannot exceed 40000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    originalPrice: { type: Number, min: [0, 'Original price cannot be negative'] },

    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'TWS',
          'Bluetooth Neckbands',
          'Data Cables',
          'Mobile Chargers',
          'Integrated Circuits & Chips',
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
    brand: { type: String, required: [true, 'Brand is required'], default: 'Nakoda' },

    images: { type: [String], default: [] },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviews: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },

    inStock: { type: Boolean, default: true },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
    },

    features: { type: [String], default: [] },
    specifications: { type: Map, of: Schema.Types.Mixed, default: {} },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
    businessName: String,
    compareAtPrice: { type: Number, default: null },

    // Extras
    sku: { type: String, trim: true, index: true },
    color: { type: String, trim: true },
    ports: { type: Number, min: 0, default: 0 },
    warrantyPeriodMonths: { type: Number, min: 0, default: 0 },
    warrantyType: { type: String, enum: ['Manufacturer', 'Seller', 'No Warranty'], default: 'No Warranty' },
    manufacturingDetails: { type: Schema.Types.Mixed, default: {} },

    // Admin-only (not returned by default)
    gst: { type: Number, min: 0, max: 100, select: false },
    hsnCode: { type: String, trim: true, select: false },
    netWeight: { type: Number, min: 0, select: false },

    // MOQ (override per product; otherwise category default)
    minOrderQtyOverride: { type: Number, min: 1, default: null },

    // Bulk pricing rules
    pricingTiers: { type: [PricingTierSchema], default: [] },
    packSize: { type: Number, min: 1, default: 1 },       // 1 = disabled
    incrementStep: { type: Number, min: 1, default: 1 },  // 1 = disabled
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

/* ────────────────────────────────────────────────────────────── */
/** Indexes */
productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ isActive: 1, inStock: 1, status: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ brand: 1 });

/* ────────────────────────────────────────────────────────────── */
/** Hooks */

// Keep inStock in sync with stockQuantity
productSchema.pre('save', function (next) {
  // @ts-ignore
  this.inStock = (this.stockQuantity || 0) > 0;
  next();
});

// Validate/sort pricing tiers (+ enforce 2 windows: 10–40 and 50–100)
productSchema.pre('validate', function (next) {
  const self = this as IProduct;
  const tiers = self.pricingTiers || [];

  // 1) sort by minQty asc
  tiers.sort((a, b) => a.minQty - b.minQty);

  // 2) basic validations (strictly increasing, non-negative price)
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (i > 0 && t.minQty <= tiers[i - 1].minQty) {
      return next(new Error('pricingTiers.minQty must be strictly increasing'));
    }
    if (t.unitPrice < 0) {
      return next(new Error('pricingTiers.unitPrice cannot be negative'));
    }
  }

  // 3) allow only 2 windows: 10–40 and 50–100
  const windows = [
    { label: '10-40',  min: 10, max: 40, found: false },
    { label: '50-100', min: 50, max: 100, found: false },
  ];

  for (const t of tiers) {
    const w = windows.find(w => t.minQty >= w.min && t.minQty <= w.max);
    if (!w) {
      return next(new Error('Only two tier windows allowed: minQty must lie in 10–40 or 50–100'));
    }
    if (w.found) {
      return next(new Error(`Duplicate tier for window ${w.label} — keep only one entry per window`));
    }
    w.found = true;
  }

  // (Optional) force both windows to be present:
  // if (!windows.every(w => w.found)) {
  //   return next(new Error('Both windows (10–40 and 50–100) must be set'));
  // }

  self.pricingTiers = tiers;
  next();
});

/* ────────────────────────────────────────────────────────────── */
/** Virtuals */

// Effective MOQ (override > category default > 1)
productSchema.virtual('minOrderQty').get(function (this: IProduct) {
  if (typeof this.minOrderQtyOverride === 'number' && this.minOrderQtyOverride >= 1) {
    return this.minOrderQtyOverride;
  }
  return CATEGORY_MOQ[this.category] ?? 1;
});

/* ────────────────────────────────────────────────────────────── */
/** Methods */

// Compute unit price for a given qty using tiers; fallback to base `price`
productSchema.methods.getUnitPriceForQty = function (this: IProduct, qty: number): number {
  if (!qty || qty < 1) return this.price;
  let unit = this.price;
  for (const t of this.pricingTiers) {
    if (qty >= t.minQty) unit = t.unitPrice;
    else break;
  }
  return unit;
};

/* ────────────────────────────────────────────────────────────── */
/** Helpers (optional use in services/controllers) */
export function getMinOrderQtyForCategory(cat: string): number {
  return CATEGORY_MOQ[cat] ?? 1;
}

/* ────────────────────────────────────────────────────────────── */
export default mongoose.model<IProduct>('Product', productSchema);
