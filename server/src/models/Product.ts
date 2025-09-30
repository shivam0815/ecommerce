// src/models/Product.ts
import mongoose, { Schema, Document } from 'mongoose'

/* ────────────────────────────────────────────────────────────── */
/* Types */
export type PricingTier = {
  minQty: number;     // e.g., 10, 50, 100
  unitPrice: number;  // INR per piece (use paise if you prefer integers)
};

type SEOFields = {
  metaTitle: string;         // <= 60 chars
  metaDescription: string;   // <= 160 chars
  canonicalPath?: string;    // e.g., `/products/<slug>`
  ogImage?: string;          // absolute URL recommended
};

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;

  // Core
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  brand: string;
  images: string[];
  imageUrl?: string; // First/primary image for backward compatibility

  // Ratings
  rating: number;
  reviews: number;
  averageRating?: number;
  ratingsCount?: number;

  // Inventory
  inStock: boolean;
  stockQuantity: number;
  stock: number; // Alias for stockQuantity (for frontend compatibility)

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
  minOrderQtyOverride?: number | null;
  // virtual
  minOrderQty?: number;

  // Bulk pricing
  pricingTiers: PricingTier[];
  packSize?: number | null;
  incrementStep?: number | null;

  // SEO (admin-editable) - FLATTENED for easier frontend access
  metaTitle?: string;         // Direct field for admin forms
  metaDescription?: string;   // Direct field for admin forms
  seo?: SEOFields;            // Keep nested structure for advanced SEO

  // Methods
  getUnitPriceForQty?(qty: number): number;

  // WhatsApp routing helpers
  shouldRouteToWhatsApp?(qty: number): boolean;
  whatsappAfterQty?: number; // virtual

  // SEO helpers
  seoTitle?: string;         // virtual (with fallback)
  seoDescription?: string;   // virtual (with fallback)
  seoCanonical?: string;     // virtual (with fallback)
  getSeoMeta?(siteName: string, baseUrl: string): {
    title: string;
    description: string;
    canonical?: string;
    image?: string;
  };
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
const PricingTierSchema = new Schema<PricingTier>(
  {
    minQty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

/* SEO sub-schema */
const SEOSchema = new Schema<SEOFields>(
  {
    metaTitle:       { type: String, trim: true, default: '', maxlength: 60 },
    metaDescription: { type: String, trim: true, default: '', maxlength: 160 },
    canonicalPath:   { type: String, trim: true, default: '' },
    ogImage:         { type: String, trim: true, default: '' },
  },
  { _id: false }
);

/* ────────────────────────────────────────────────────────────── */
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
    imageUrl: { type: String, trim: true }, // Primary image for backward compatibility

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
    sku: { 
      type: String, 
      trim: true, 
      index: true, 
      sparse: true, // Allow multiple null/undefined values
      validate: {
        validator: function(v: string) {
          return !v || v.length >= 3; // If provided, must be >= 3 chars
        },
        message: 'SKU must be at least 3 characters long'
      }
    },
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

    // SEO Fields - BOTH flattened AND nested for flexibility
    metaTitle: { 
      type: String, 
      trim: true, 
      maxlength: [60, 'Meta title cannot exceed 60 characters'],
      validate: {
        validator: function(v: string) {
          return !v || v.length <= 60;
        },
        message: 'Meta title should be under 60 characters for better SEO'
      }
    },
    metaDescription: { 
      type: String, 
      trim: true, 
      maxlength: [160, 'Meta description cannot exceed 160 characters'],
      validate: {
        validator: function(v: string) {
          return !v || v.length <= 160;
        },
        message: 'Meta description should be under 160 characters for better SEO'
      }
    },
    seo: { type: SEOSchema, default: () => ({}) }, // Advanced SEO fields
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        if (ret.specifications instanceof Map) {
          ret.specifications = Object.fromEntries(ret.specifications);
        }
        // Add stock alias for frontend compatibility
        ret.stock = ret.stockQuantity;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        if (ret.specifications instanceof Map) {
          ret.specifications = Object.fromEntries(ret.specifications);
        }
        // Add stock alias for frontend compatibility
        ret.stock = ret.stockQuantity;
        return ret;
      },
    },
  }
);

/* ────────────────────────────────────────────────────────────── */
/** Indexes */
productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });
productSchema.index({ metaTitle: 1 }); // Direct field index for admin search
productSchema.index({ 'seo.metaTitle': 1 }); // Nested field index
productSchema.index({ sku: 1 }, { sparse: true }); // Unique SKU index (sparse allows nulls)

productSchema.index({ category: 1, price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ isActive: 1, inStock: 1, status: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ brand: 1 });

/* ────────────────────────────────────────────────────────────── */
/** Helpers */
const stripEmojis = (s: string) => s?.replace(/[\u{1F300}-\u{1FAFF}]/gu, '') || '';
const clamp = (s: string, n: number) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/* ────────────────────────────────────────────────────────────── */
/** Virtuals */

// stock alias for frontend compatibility
productSchema.virtual('stock').get(function (this: IProduct) {
  return this.stockQuantity;
});

// Effective MOQ (override > category default > 1)
productSchema.virtual('minOrderQty').get(function (this: IProduct) {
  if (typeof this.minOrderQtyOverride === 'number' && this.minOrderQtyOverride >= 1) {
    return this.minOrderQtyOverride;
  }
  return CATEGORY_MOQ[this.category] ?? 1;
});

// WhatsApp routing threshold: strictly greater than 100 goes to WhatsApp
productSchema.virtual('whatsappAfterQty').get(function (this: IProduct) {
  return 100; // >100 => WhatsApp
});

// SEO fallbacks that guarantee "compulsory for best results"
productSchema.virtual('seoTitle').get(function (this: IProduct) {
  const site = 'Nakoda Mobile';
  const t = this.metaTitle?.trim() || this.seo?.metaTitle?.trim();
  if (t) return t;
  return clamp(`${this.name} — Bulk Supplier | ${site}`, 60);
});

productSchema.virtual('seoDescription').get(function (this: IProduct) {
  const d = this.metaDescription?.trim() || this.seo?.metaDescription?.trim();
  if (d) return d;
  const hint = this.category || 'mobile parts';
  return clamp(`Buy ${this.name} in bulk (${hint}). Tiered pricing, GST invoice & fast shipping. Request a quote.`, 160);
});

productSchema.virtual('seoCanonical').get(function (this: IProduct) {
  if (this.seo?.canonicalPath) return this.seo.canonicalPath;
  // default canonical by slug if present
  // @ts-ignore
  const slug = this.slug || (this as any).get('slug'); // if you store slug on the doc elsewhere
  return slug ? `/products/${slug}` : undefined;
});

/* ────────────────────────────────────────────────────────────── */
/** Hooks */

// Keep inStock in sync with stockQuantity
productSchema.pre('save', function (next) {
  // @ts-ignore
  this.inStock = (this.stockQuantity || 0) > 0;
  
  // Sync imageUrl with first image for backward compatibility
  if (Array.isArray(this.images) && this.images.length > 0 && !this.imageUrl) {
    this.imageUrl = this.images[0];
  }
  
  next();
});

// Validate/sort pricing tiers + SEO cleanup
productSchema.pre('validate', function (next) {
  const self = this as IProduct;
  const tiers = self.pricingTiers || [];

  // 1) sort by minQty asc
  tiers.sort((a, b) => a.minQty - b.minQty);

  // 2) basic validations
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (i > 0 && t.minQty <= tiers[i - 1].minQty) {
      return next(new Error('pricingTiers.minQty must be strictly increasing'));
    }
    if (t.unitPrice < 0) {
      return next(new Error('pricingTiers.unitPrice cannot be negative'));
    }
  }

  // 3) allow exactly 3 windows: 10–40, 50–90, and exactly 100
  const windows = [
    { key: '10-40', match: (q: number) => q >= 10 && q <= 40, found: false },
    { key: '50-90', match: (q: number) => q >= 50 && q <= 90, found: false },
    { key: '100',   match: (q: number) => q === 100,          found: false },
  ];

  if (tiers.length > 3) {
    return next(new Error('Only three pricing tiers allowed: one in 10–40, one in 50–90, and one at exactly 100.'));
  }

  for (const t of tiers) {
    const w = windows.find(w => w.match(t.minQty));
    if (!w) {
      return next(new Error('Tier minQty must be in 10–40, 50–90, or exactly 100.'));
    }
    if (w.found) {
      return next(new Error(`Duplicate tier for window ${w.key} — keep only one entry per window.`));
    }
    w.found = true;
  }

  // SEO: sanitize + clamp both flattened and nested fields
  if (self.metaTitle) {
    self.metaTitle = clamp(stripEmojis(self.metaTitle), 60);
  }
  if (self.metaDescription) {
    self.metaDescription = clamp(stripEmojis(self.metaDescription), 160);
  }
  if (self.seo) {
    self.seo.metaTitle = clamp(stripEmojis(self.seo.metaTitle || ''), 60);
    self.seo.metaDescription = clamp(stripEmojis(self.seo.metaDescription || ''), 160);
    self.seo.canonicalPath = stripEmojis(self.seo.canonicalPath || '');
    self.seo.ogImage = stripEmojis(self.seo.ogImage || '');
  }

  self.pricingTiers = tiers;
  next();
});

/* ────────────────────────────────────────────────────────────── */
/** Methods */

// For qty > 100, don't show price; route to WhatsApp
productSchema.methods.shouldRouteToWhatsApp = function (this: IProduct, qty: number): boolean {
  return Number(qty) > 100;
};

// Compute unit price for a given qty using tiers; fallback to base `price`
// (Qty = 100 will use the "exactly 100" tier if configured. For qty > 100,
// UI should route to WhatsApp and hide price.)
productSchema.methods.getUnitPriceForQty = function (this: IProduct, qty: number): number {
  if (!qty || qty < 1) return this.price;
  let unit = this.price;
  for (const t of this.pricingTiers) {
    if (qty >= t.minQty) unit = t.unitPrice;
    else break;
  }
  return unit;
};

// Return fully composed SEO meta for rendering layers (React <SEO/>)
productSchema.methods.getSeoMeta = function (
  this: IProduct,
  siteName: string,
  baseUrl: string
) {
  const title = (this as any).seoTitle as string;
  const description = (this as any).seoDescription as string;
  const canonical = (this as any).seoCanonical as string | undefined;
  const image =
    this.seo?.ogImage ||
    this.imageUrl ||
    (Array.isArray(this.images) && this.images.length ? this.images[0] : undefined);

  return {
    title,
    description,
    canonical: canonical ? `${baseUrl}${canonical}` : undefined,
    image,
  };
};

/* ────────────────────────────────────────────────────────────── */
export default mongoose.model<IProduct>('Product', productSchema);
