// src/controllers/productController.ts - COMPLETE FIXED VERSION
import { Request, Response } from 'express';
import Product from '../models/Product';
import { AuthRequest } from '../types';

// ✅ FIXED: Create Product (Admin)
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    console.log('📦 Creating product with data:', req.body);
    
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

    // ✅ CRITICAL: Ensure product is visible by default
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
      rating: 0,
      reviews: 0,
      // ✅ CRITICAL: Set visibility flags
      isActive: true,
      inStock: Number(stockQuantity) > 0,
      status: 'active'
    };

    console.log('💾 Saving product:', productData);

    const product = new Product(productData);
    const savedProduct = await product.save();

    console.log('✅ Product created successfully:', {
      id: savedProduct._id,
      name: savedProduct.name,
      isActive: savedProduct.isActive,
      inStock: savedProduct.inStock,
      status: savedProduct.status,
      stockQuantity: savedProduct.stockQuantity
    });

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

// ✅ FIXED: Get Products (Public - User Facing)
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
    } = req.query;

    console.log('🔍 Fetching products with params:', req.query);

    // ✅ CRITICAL: Only show ACTIVE and VISIBLE products to users
    const query: any = {
      isActive: true,
      status: 'active'
      // Note: Don't filter by inStock here - let users see out-of-stock items
    };

    // Add category filter
    if (category && category !== 'all' && category !== '') {
      query.category = { $regex: new RegExp(category as string, 'i') };
    }

    // Add search filter
    if (search && search !== '') {
      query.$or = [
        { name: { $regex: new RegExp(search as string, 'i') } },
        { description: { $regex: new RegExp(search as string, 'i') } },
        { tags: { $in: [new RegExp(search as string, 'i')] } },
        { brand: { $regex: new RegExp(search as string, 'i') } }
      ];
    }

    // Add price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Build sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    console.log('🔍 Final query:', query);
    console.log('📊 Sort options:', sortOptions);

    // Execute query
    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / Number(limit));

    console.log('📦 Products found:', {
      count: products.length,
      total: totalProducts,
      page: Number(page),
      totalPages,
      query
    });

    // ✅ FIXED: Always return success with products array
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

// ✅ FIXED: Get All Products (Admin)
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
    } = req.query;

    console.log('🔍 Admin fetching all products:', req.query);

    // ✅ Admin can see ALL products (including inactive)
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search as string, 'i') } },
        { description: { $regex: new RegExp(search as string, 'i') } },
        { brand: { $regex: new RegExp(search as string, 'i') } }
      ];
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const totalProducts = await Product.countDocuments(query);

    console.log('📦 Admin products found:', products.length);

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

// ✅ NEW: Debug endpoint to check product visibility
export const debugProducts = async (req: Request, res: Response) => {
  try {
    const allProducts = await Product.find({})
      .select('name isActive status inStock stockQuantity category createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    const activeProducts = await Product.find({ 
      isActive: true, 
      status: 'active' 
    }).countDocuments();

    const inactiveProducts = await Product.find({ 
      $or: [
        { isActive: false },
        { status: { $ne: 'active' } }
      ]
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

// ✅ Get single product
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    
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

    // ✅ Auto-calculate inStock based on stockQuantity
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

    console.log('✅ Product updated:', {
      id: product._id,
      name: product.name,
      isActive: product.isActive,
      status: product.status
    });

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

    console.log('🗑️ Product deleted:', product.name);

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
