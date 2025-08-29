// src/controllers/productController.ts - COMPLETE VERSION
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

// ✅ Create Product (Admin)
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      originalPrice,
      category,
      subcategory,
      brand = 'Nakoda',
      stockQuantity = 0,
      features = [],
      specifications = {},
      tags = [],
      images = []
    } = req.body;

    const productData = {
      name: name?.trim(),
      description: description?.trim(),
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      category,
      subcategory,
      brand,
      stockQuantity: Number(stockQuantity),
      features: Array.isArray(features) ? features : [],
      specifications: specifications || {},
      tags: Array.isArray(tags) ? tags : [],
      images: Array.isArray(images) ? images : [],

      // legacy counters (keep if you use them elsewhere)
      rating: 0,
      reviews: 0,

      // visibility
      isActive: true,
      inStock: Number(stockQuantity) > 0,
      status: 'active',

      // aggregates used by cards
      averageRating: 0,
      ratingsCount: 0,
    };

    const product = new Product(productData);
    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: savedProduct
    });

  } catch (error: any) {
    console.error('❌ Create product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create product'
    });
  }
};

// ✅ Get Products (Public - User Facing)
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
      maxPrice
    } = req.query as any;

    const query: any = { isActive: true, status: 'active' };

    if (category && category !== 'all' && category !== '') {
      query.category = { $regex: new RegExp(category, 'i') };
    }

    if (search && search !== '') {
      query.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { brand: { $regex: new RegExp(search, 'i') } }
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      // we only exclude __v; averageRating & ratingsCount will be included
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / Number(limit));

    res.json({
      success: true,
      products: products || [],
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

// ✅ Get All Products (Admin)
export const getAllProducts = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query as any;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } },
        { brand: { $regex: new RegExp(search, 'i') } }
      ];
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
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

// ✅ Debug endpoint (unchanged)
export const debugProducts = async (req: Request, res: Response) => {
  try {
    const allProducts = await Product.find({})
      .select('name isActive status inStock stockQuantity category createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    const activeProducts = await Product.find({ isActive: true, status: 'active' }).countDocuments();
    const inactiveProducts = await Product.find({
      $or: [{ isActive: false }, { status: { $ne: 'active' } }]
    }).countDocuments();

    res.json({
      success: true,
      summary: {
        total: allProducts.length,
        active: activeProducts,
        inactive: inactiveProducts
      },
      recentProducts: allProducts.map(p => ({
        _id: p._id,
        name: p.name,
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
      .select('-__v') // includes averageRating & ratingsCount
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product
    });

  } catch (error: any) {
    console.error('❌ Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch product'
    });
  }
};

// ✅ Update product
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.stockQuantity !== undefined) {
      updateData.inStock = Number(updateData.stockQuantity) > 0;
    }

    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
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
      product
    });

  } catch (error: any) {
    console.error('❌ Update product error:', error);
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
