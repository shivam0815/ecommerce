// src/controllers/productController.ts - COMPLETE VERSION WITH SKU & META SUPPORT
import { Request, Response } from 'express';
import Product from '../models/Product';
import type { AuthRequest } from '../types';

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

// NEW: SKU validation helper
const validateSKU = async (sku: string | undefined, excludeId?: string): Promise<string | null> => {
  if (!sku) return null;
  
  const trimmedSKU = sku.trim();
  if (trimmedSKU.length < 3) {
    throw new Error('SKU must be at least 3 characters long');
  }

  // Check for uniqueness
  const query: any = { sku: trimmedSKU };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingProduct = await Product.findOne(query);
  if (existingProduct) {
    throw new Error(`SKU "${trimmedSKU}" already exists. Please use a unique SKU.`);
  }

  return trimmedSKU;
};

// NEW: Meta fields validation helper
const validateMetaFields = (metaTitle?: string, metaDescription?: string) => {
  if (metaTitle && metaTitle.length > 60) {
    throw new Error('Meta title must be 60 characters or less for optimal SEO');
  }
  if (metaDescription && metaDescription.length > 160) {
    throw new Error('Meta description must be 160 characters or less for optimal SEO');
  }
};

// NEW: Normalize product output for frontend compatibility
const normalizeProductOutput = (product: any) => {
  if (!product) return product;
  
  const normalized = product.toObject ? product.toObject({ virtuals: true }) : product;
  
  return {
    ...normalized,
    // Ensure stock field exists for frontend compatibility
    stock: normalized.stock || normalized.stockQuantity || 0,
    // Ensure meta fields are accessible (check both flattened and nested)
    metaTitle: normalized.metaTitle || normalized.seo?.metaTitle || '',
    metaDescription: normalized.metaDescription || normalized.seo?.metaDescription || '',
    sku: normalized.sku || '',
  };
};

// ✅ Create Product (Admin) - UPDATED with SKU & Meta support
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
      // NEW: SKU and Meta fields
      sku,
      metaTitle,
      metaDescription,
      // Pricing tiers
      pricingTiers = [],
      minOrderQtyOverride,
      packSize = 1,
      incrementStep = 1,
    } = req.body;

    // Validation
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

    // NEW: Validate SKU if provided
    let validatedSKU: string | null = null;
    try {
      validatedSKU = await validateSKU(sku);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // NEW: Validate meta fields
    try {
      validateMetaFields(metaTitle, metaDescription);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Handle stock field mapping
    const finalStockQuantity = stockQuantity || stock || 0;

    // Handle pricing
    const parsedPrice = Number(price);
    let finalCompareAtPrice = null;
    let finalOriginalPrice = null;

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
      imageUrl: normArray(images)[0] || undefined, // Set first image as primary

      // NEW: SKU and Meta fields
      sku: validatedSKU || undefined,
      metaTitle: metaTitle?.trim() || undefined,
      metaDescription: metaDescription?.trim() || undefined,

      // Pricing tiers
      pricingTiers: Array.isArray(pricingTiers) ? pricingTiers : [],
      minOrderQtyOverride: minOrderQtyOverride ? Number(minOrderQtyOverride) : null,
      packSize: Number(packSize) || 1,
      incrementStep: Number(incrementStep) || 1,

      // Legacy counters (keep if you use them elsewhere)
      rating: 0,
      reviews: 0,

      // Visibility
      isActive: true,
      inStock: Number(finalStockQuantity) > 0,
      status: 'active',

      // Aggregates used by cards
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

// ✅ Get Products (Public - User Facing) - UPDATED with SKU search
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
    } = req.query as any;

    const query: any = { isActive: true, status: 'active' };

    if (category && category !== 'all' && category !== '') {
      query.category = { $regex: new RegExp(category, 'i') };
    }

    // NEW: Enhanced search including SKU and meta fields
    if (search && search !== '') {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } },
        { brand: searchRegex },
        { sku: searchRegex }, // NEW: Search by SKU
        { metaTitle: searchRegex }, // NEW: Search by meta title
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // NEW: Stock filtering
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
      sortOptions.createdAt = -1; // Default sort
    }

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / Number(limit));

    // Normalize all products for frontend
    const normalizedProducts = products.map(normalizeProductOutput);

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

// ✅ Get All Products (Admin) - UPDATED with SKU and Meta search
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
      sortOrder = 'desc'
    } = req.query as any;

    const query: any = {};

    // NEW: Enhanced admin search including SKU and meta fields
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { sku: searchRegex }, // NEW: Search by SKU
        { metaTitle: searchRegex }, // NEW: Search by meta title
        { category: searchRegex },
      ];
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    // NEW: Stock filtering for admin
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
      sortOptions.createdAt = -1; // Default sort
    }

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);

    // Normalize all products for admin frontend
    const normalizedProducts = products.map(normalizeProductOutput);

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

// ✅ Debug endpoint - UPDATED with SKU and Meta info
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

    // NEW: Count products with SKUs and meta titles
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

// ✅ Get single product (explicit select for consistency)
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .select('-__v') // includes averageRating, ratingsCount, sku, metaTitle, metaDescription
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: normalizeProductOutput(product)
    });

  } catch (error: any) {
    console.error('❌ Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch product'
    });
  }
};

// ✅ Update product - UPDATED with SKU & Meta support
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Handle stock field mapping
    if (updateData.stock !== undefined && updateData.stockQuantity === undefined) {
      updateData.stockQuantity = updateData.stock;
    }

    if (updateData.stockQuantity !== undefined) {
      updateData.inStock = Number(updateData.stockQuantity) > 0;
    }

    // NEW: Validate SKU if being updated
    if (updateData.sku !== undefined) {
      try {
        updateData.sku = await validateSKU(updateData.sku, id) || undefined;
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }

    // NEW: Validate meta fields
    try {
      validateMetaFields(updateData.metaTitle, updateData.metaDescription);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Clean meta fields
    if (updateData.metaTitle !== undefined) {
      updateData.metaTitle = updateData.metaTitle ? updateData.metaTitle.trim() : undefined;
    }
    if (updateData.metaDescription !== undefined) {
      updateData.metaDescription = updateData.metaDescription ? updateData.metaDescription.trim() : undefined;
    }

    // Handle pricing validation
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

    // Update isActive based on status
    if (updateData.status) {
      updateData.isActive = updateData.status === 'active';
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
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

// NEW: Bulk operations for admin dashboard compatibility
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

    // Validate meta fields if being updated
    try {
      validateMetaFields(updateData.metaTitle, updateData.metaDescription);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Update isActive based on status if provided
    if (updateData.status) {
      updateData.isActive = updateData.status === 'active';
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

// NEW: Get products with low stock
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

    const normalizedProducts = products.map(normalizeProductOutput);

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
