// src/controllers/productController.ts - COMPLETE VERSION WITH SKU, META & PRICING WINDOWS (10–40, 50–90, 100) + WA >100
import { Request, Response } from 'express';
import Product from '../models/Product';
import type { AuthRequest } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Helpers: parsing / normalization */

const normArray = (v: any) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const normNumber = (v: any, def = 0) => (v === '' || v == null ? def : Number(v));

const normSpecs = (value: any) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value as Map<string, any>);
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

// Pricing windows: exactly one tier allowed per window
const PRICING_WINDOWS = [
  { key: '10-40', match: (q: number) => q >= 10 && q <= 40 },
  { key: '50-90', match: (q: number) => q >= 50 && q <= 90 },
  { key: '100',   match: (q: number) => q === 100 },
] as const;

type Tier = { minQty: number; unitPrice: number };

const parsePricingTiers = (val: any): Tier[] => {
  let tiers: any = val;
  if (typeof val === 'string') {
    try {
      tiers = JSON.parse(val);
    } catch {
      tiers = [];
    }
  }
  if (!Array.isArray(tiers)) return [];
  // keep only objects with valid numbers
  return tiers
    .map((t) => ({
      minQty: Number(t?.minQty),
      unitPrice: Number(t?.unitPrice),
    }))
    .filter((t) => Number.isFinite(t.minQty) && Number.isFinite(t.unitPrice) && t.minQty > 0 && t.unitPrice >= 0);
};

// Keep at most one entry per allowed window; choose the one with **lowest unitPrice** if duplicates appear
const normalizePricingTiersToWindows = (tiers: Tier[]): Tier[] => {
  const byWindow: Record<string, Tier | undefined> = {};
  for (const t of tiers) {
    const w = PRICING_WINDOWS.find((w) => w.match(t.minQty));
    if (!w) continue; // ignore out-of-policy tiers
    const existing = byWindow[w.key];
    if (!existing || t.unitPrice < existing.unitPrice) {
      byWindow[w.key] = { minQty: t.minQty, unitPrice: t.unitPrice };
    }
  }
  // If admin provided none for a window, we simply omit it (model-level validation may still enforce rules)
  const cleaned: Tier[] = [];
  for (const w of PRICING_WINDOWS) {
    if (byWindow[w.key]) cleaned.push(byWindow[w.key]!);
  }
  // sort by minQty asc (100 will come last)
  cleaned.sort((a, b) => a.minQty - b.minQty);
  return cleaned;
};

// Server-side validation mirroring model rules (defensive)
const validatePricingWindows = (tiers: Tier[]) => {
  if (tiers.length > 3) {
    throw new Error('Only three pricing tiers allowed: one in 10–40, one in 50–90, and one at exactly 100.');
  }
  const found: Record<string, boolean> = { '10-40': false, '50-90': false, '100': false };
  for (const t of tiers) {
    const w = PRICING_WINDOWS.find((w) => w.match(t.minQty));
    if (!w) throw new Error('Tier minQty must be in 10–40, 50–90, or exactly 100.');
    if (found[w.key]) throw new Error(`Duplicate tier for window ${w.key} — keep only one entry per window.`);
    found[w.key] = true;
  }
};

// Compute unit price for a given qty using given tiers (sorted by minQty ascending)
const computeUnitPrice = (basePrice: number, tiers: Tier[], qty: number): number => {
  if (!qty || qty < 1) return basePrice;
  let unit = basePrice;
  for (const t of tiers) {
    if (qty >= t.minQty) unit = t.unitPrice;
    else break;
  }
  return unit;
};

/* ────────────────────────────────────────────────────────────── */
/* SKU & Meta helpers */

const validateSKU = async (sku: string | undefined, excludeId?: string): Promise<string | null> => {
  if (!sku) return null;
  const trimmedSKU = sku.trim();
  if (trimmedSKU.length < 3) {
    throw new Error('SKU must be at least 3 characters long');
  }
  const query: any = { sku: trimmedSKU };
  if (excludeId) query._id = { $ne: excludeId };
  const existingProduct = await Product.findOne(query);
  if (existingProduct) {
    throw new Error(`SKU "${trimmedSKU}" already exists. Please use a unique SKU.`);
  }
  return trimmedSKU;
};

const validateMetaFields = (metaTitle?: string, metaDescription?: string) => {
  if (metaTitle && metaTitle.length > 60) {
    throw new Error('Meta title must be 60 characters or less for optimal SEO');
  }
  if (metaDescription && metaDescription.length > 160) {
    throw new Error('Meta description must be 160 characters or less for optimal SEO');
  }
};

/* ────────────────────────────────────────────────────────────── */
/* Output normalization (adds WA threshold + optional qty preview) */

const WHATSAPP_AFTER_QTY = 100;

const normalizeProductOutput = (product: any, opts?: { qty?: number }) => {
  if (!product) return product;

  // If it's a mongoose doc, convert to plain object (include virtuals)
  const normalized = product.toObject ? product.toObject({ virtuals: true }) : product;

  // Derive tiers from doc (already normalized by model), but be defensive
  const tiers: Tier[] = Array.isArray(normalized.pricingTiers)
    ? normalized.pricingTiers.map((t: any) => ({ minQty: Number(t.minQty), unitPrice: Number(t.unitPrice) }))
    : [];

  const qty = Number(opts?.qty ?? NaN);
  const hasQty = Number.isFinite(qty);

  // Preview computation only if qty supplied
  const shouldRouteToWhatsApp = hasQty ? qty > WHATSAPP_AFTER_QTY : undefined;
  const unitPriceForQty = hasQty ? computeUnitPrice(normalized.price, tiers.sort((a, b) => a.minQty - b.minQty), qty) : undefined;

  return {
    ...normalized,
    // Frontend compatibility
    stock: normalized.stock || normalized.stockQuantity || 0,
    metaTitle: normalized.metaTitle || normalized.seo?.metaTitle || '',
    metaDescription: normalized.metaDescription || normalized.seo?.metaDescription || '',
    sku: normalized.sku || '',
    // WhatsApp routing hint (virtual in model, but ensure presence here)
    whatsappAfterQty: normalized.whatsappAfterQty ?? WHATSAPP_AFTER_QTY,
    // Optional pricing preview
    _pricingPreview: hasQty
      ? {
          qty,
          shouldRouteToWhatsApp: Boolean(shouldRouteToWhatsApp),
          unitPriceForQty,
        }
      : undefined,
  };
};

/* ────────────────────────────────────────────────────────────── */
/* Controllers */

// ✅ Create Product (Admin) - UPDATED with SKU, Meta & Pricing windows support
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      originalPrice,
      compareAtPrice,
      category,
      subcategory,
      brand = 'Nakoda',
      stockQuantity = 0,
      stock, // Alternative field name
      features = [],
      specifications = {},
      tags = [],
      images = [],
      // SKU & Meta fields
      sku,
      metaTitle,
      metaDescription,
      // Pricing tiers (expect array or JSON string)
      pricingTiers = [],
      minOrderQtyOverride,
      packSize = 1,
      incrementStep = 1,
    } = req.body;

    // Required fields
    if (!name?.trim() || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and category are required',
        missing: {
          name: !name?.trim(),
          price: !price,
          category: !category,
        },
      });
    }

    // SKU & Meta validation
    let validatedSKU: string | null = null;
    try {
      validatedSKU = await validateSKU(sku);
      validateMetaFields(metaTitle, metaDescription);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // Handle stock field mapping
    const finalStockQuantity = stockQuantity || stock || 0;

    // Handle base/compare/original price
    const parsedPrice = Number(price);
    let finalCompareAtPrice: number | null = null;
    let finalOriginalPrice: number | null = null;

    if (compareAtPrice) {
      const comparePrice = Number(compareAtPrice);
      if (comparePrice > parsedPrice) {
        finalCompareAtPrice = comparePrice;
        finalOriginalPrice = comparePrice;
      }
    } else if (originalPrice) {
      const origPrice = Number(originalPrice);
      if (origPrice > parsedPrice) {
        finalOriginalPrice = origPrice;
        finalCompareAtPrice = origPrice;
      }
    }

    // Pricing tiers: parse → normalize → validate
    const parsedTiers = parsePricingTiers(pricingTiers);
    const cleanTiers = normalizePricingTiersToWindows(parsedTiers);
    try {
      if (cleanTiers.length > 0) validatePricingWindows(cleanTiers);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const productData = {
      name: name.trim(),
      description: description?.trim() || '',
      price: parsedPrice,
      compareAtPrice: finalCompareAtPrice,
      originalPrice: finalOriginalPrice,
      category,
      subcategory,
      brand,
      stockQuantity: Number(finalStockQuantity),
      features: normArray(features),
      specifications: normSpecs(specifications),
      tags: normArray(tags),
      images: normArray(images),
      imageUrl: normArray(images)[0] || undefined,

      // SKU & Meta
      sku: validatedSKU || undefined,
      metaTitle: metaTitle?.trim() || undefined,
      metaDescription: metaDescription?.trim() || undefined,

      // Pricing tiers (policy-safe)
      pricingTiers: cleanTiers,
      minOrderQtyOverride: minOrderQtyOverride ? Number(minOrderQtyOverride) : null,
      packSize: Number(packSize) || 1,
      incrementStep: Number(incrementStep) || 1,

      // Counters / visibility
      rating: 0,
      reviews: 0,
      isActive: true,
      inStock: Number(finalStockQuantity) > 0,
      status: 'active',
      averageRating: 0,
      ratingsCount: 0,
    };

    const product = new Product(productData);
    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: normalizeProductOutput(savedProduct)
    });

  } catch (error: any) {
    console.error('❌ Create product error:', error);

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create product'
    });
  }
};

// ✅ Get Products (Public) - now supports optional qty preview (query ?qty=XX)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice,
      maxPrice,
      stockFilter,
      qty, // optional: preview pricing for this qty
    } = req.query as any;

    const qtyNum = qty ? Number(qty) : undefined;

    const query: any = { isActive: true, status: 'active' };

    if (category && category !== 'all' && category !== '') {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  query.category = { $regex: new RegExp(`^${escape(category)}$`, 'i') };
}


    if (search && search !== '') {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } },
        { brand: searchRegex },
        { sku: searchRegex },
        { metaTitle: searchRegex },
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (stockFilter) {
      switch (stockFilter) {
        case 'in-stock':
          query.stockQuantity = { $gt: 0 };
          break;
        case 'low-stock':
          query.stockQuantity = { $gt: 0, $lte: 10 };
          break;
        case 'out-of-stock':
          query.stockQuantity = 0;
          break;
      }
    }

    const sortOptions: any = {};
    const allowedSortFields = ['name', 'price', 'stockQuantity', 'createdAt', 'rating', 'averageRating'];
    if (allowedSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions.createdAt = -1;
    }

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / Number(limit));

    const normalizedProducts = products.map((p) => normalizeProductOutput(p, { qty: qtyNum }));

    res.json({
      success: true,
      products: normalizedProducts || [],
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalProducts,
        hasMore: Number(page) < totalPages,
        limit: Number(limit)
      }
    });

  } catch (error: any) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products',
      products: []
    });
  }
};

// ✅ Get All Products (Admin) - with SKU/Meta search; optional qty preview (?qty=)
export const getAllProducts = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      stockFilter,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      qty,
    } = req.query as any;

    const qtyNum = qty ? Number(qty) : undefined;

    const query: any = {};

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { sku: searchRegex },
        { metaTitle: searchRegex },
        { category: searchRegex },
      ];
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (stockFilter) {
      switch (stockFilter) {
        case 'in-stock':
          query.stockQuantity = { $gt: 10 };
          break;
        case 'low-stock':
          query.stockQuantity = { $gt: 0, $lte: 10 };
          break;
        case 'out-of-stock':
          query.stockQuantity = 0;
          break;
      }
    }

    const sortOptions: any = {};
    const allowedSortFields = ['name', 'price', 'stockQuantity', 'category', 'createdAt', 'updatedAt', 'rating', 'sku', 'metaTitle'];
    if (allowedSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions.createdAt = -1;
    }

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);

    const normalizedProducts = products.map((p) => normalizeProductOutput(p, { qty: qtyNum }));

    res.json({
      success: true,
      products: normalizedProducts,
      totalProducts,
      totalPages: Math.ceil(totalProducts / Number(limit)),
      currentPage: Number(page),
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasMore: Number(page) < Math.ceil(totalProducts / Number(limit))
      }
    });

  } catch (error: any) {
    console.error('❌ Admin get products error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products'
    });
  }
};

// ✅ Debug endpoint - with SKU/Meta
export const debugProducts = async (req: Request, res: Response) => {
  try {
    const allProducts = await Product.find({})
      .select('name isActive status inStock stockQuantity category sku metaTitle createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    const activeProducts = await Product.find({ isActive: true, status: 'active' }).countDocuments();
    const inactiveProducts = await Product.find({
      $or: [{ isActive: false }, { status: { $ne: 'active' } }]
    }).countDocuments();

    const productsWithSKU = await Product.countDocuments({ sku: { $exists: true, $nin: [null, ''] } });
    const productsWithMetaTitle = await Product.countDocuments({ metaTitle: { $exists: true, $nin: [null, ''] } });

    res.json({
      success: true,
      summary: {
        total: allProducts.length,
        active: activeProducts,
        inactive: inactiveProducts,
        withSKU: productsWithSKU,
        withMetaTitle: productsWithMetaTitle,
      },
      recentProducts: allProducts.map(p => ({
        _id: p._id,
        name: p.name,
        sku: p.sku || 'No SKU',
        metaTitle: p.metaTitle || 'No Meta Title',
        isActive: p.isActive,
        status: p.status,
        inStock: p.inStock,
        stockQuantity: p.stockQuantity,
        category: p.category,
        createdAt: p.createdAt,
        visibleToUsers: p.isActive && p.status === 'active'
      }))
    });

  } catch (error: any) {
    console.error('❌ Debug products error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ✅ Get single product - supports optional qty preview (?qty=)
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { qty } = req.query as any;
    const qtyNum = qty ? Number(qty) : undefined;

    const product = await Product.findById(id)
      .select('-__v')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: normalizeProductOutput(product, { qty: qtyNum })
    });

  } catch (error: any) {
    console.error('❌ Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch product'
    });
  }
};

// ✅ Update product - UPDATED with SKU, Meta & Pricing windows support
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // stock mapping
    if (updateData.stock !== undefined && updateData.stockQuantity === undefined) {
      updateData.stockQuantity = updateData.stock;
    }
    if (updateData.stockQuantity !== undefined) {
      updateData.inStock = Number(updateData.stockQuantity) > 0;
    }

    // SKU / Meta validation
    if (updateData.sku !== undefined) {
      try {
        updateData.sku = await validateSKU(updateData.sku, id) || undefined;
      } catch (error: any) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }
    try {
      validateMetaFields(updateData.metaTitle, updateData.metaDescription);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // Clean meta fields
    if (updateData.metaTitle !== undefined) {
      updateData.metaTitle = updateData.metaTitle ? updateData.metaTitle.trim() : undefined;
    }
    if (updateData.metaDescription !== undefined) {
      updateData.metaDescription = updateData.metaDescription ? updateData.metaDescription.trim() : undefined;
    }

    // Price consistency
    if (updateData.price && updateData.compareAtPrice) {
      const price = Number(updateData.price);
      const comparePrice = Number(updateData.compareAtPrice);
      if (comparePrice <= price) {
        return res.status(400).json({
          success: false,
          message: 'Compare at price must be greater than the regular price'
        });
      }
    }

    // Pricing tiers normalization & validation if provided
    if (updateData.pricingTiers !== undefined) {
      const parsedTiers = parsePricingTiers(updateData.pricingTiers);
      const cleanTiers = normalizePricingTiersToWindows(parsedTiers);
      try {
        if (cleanTiers.length > 0) validatePricingWindows(cleanTiers);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message });
      }
      updateData.pricingTiers = cleanTiers;
    }

    // status to isActive
    if (updateData.status) {
      updateData.isActive = updateData.status === 'active';
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: normalizeProductOutput(product)
    });

  } catch (error: any) {
    console.error('❌ Update product error:', error);

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update product'
    });
  }
};

// ✅ Delete product
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error: any) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete product'
    });
  }
};

// ✅ Bulk update (Admin) - Meta validation preserved
export const bulkUpdateProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { productIds, updateData } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }

    if (!updateData || typeof updateData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Update data is required'
      });
    }

    try {
      validateMetaFields(updateData.metaTitle, updateData.metaDescription);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (updateData.status) {
      updateData.isActive = updateData.status === 'active';
    }

    // If bulk-updating pricing tiers, normalize them too
    if (updateData.pricingTiers !== undefined) {
      const parsedTiers = parsePricingTiers(updateData.pricingTiers);
      const cleanTiers = normalizePricingTiersToWindows(parsedTiers);
      try {
        if (cleanTiers.length > 0) validatePricingWindows(cleanTiers);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message });
      }
      updateData.pricingTiers = cleanTiers;
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { ...updateData, updatedAt: new Date() } },
      { runValidators: true }
    );

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} products`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });

  } catch (error: any) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ Low stock
export const getLowStockProducts = async (req: AuthRequest, res: Response) => {
  try {
    const threshold = Number(req.query.threshold) || 10;

    const products = await Product.find({
      stockQuantity: { $gt: 0, $lte: threshold },
      isActive: true
    })
      .sort({ stockQuantity: 1 })
      .select('-__v')
      .lean();

    const normalizedProducts = products.map((p) => normalizeProductOutput(p));

    res.json({
      success: true,
      products: normalizedProducts,
      totalProducts: normalizedProducts.length,
      totalPages: 1,
      currentPage: 1,
    });
  } catch (error: any) {
    console.error('❌ Low stock products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock products'
    });
  }
};
