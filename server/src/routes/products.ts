import express from 'express';
import Product from '../models/Product';

const router = express.Router();

// ✅ Get all active products (public route for users)
router.get('/', async (req, res) => {
  try {
    console.log('🛍️ Fetching all products for users...');
    
    const { category, search, sortBy = 'createdAt', order = 'desc', page = 1, limit = 50 } = req.query;

    const filter: any = { 
      isActive: true,
      status: 'active'
    };

    // Category filter
    if (category && category !== 'all') {
      filter.category = category;
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = order === 'desc' ? -1 : 1;

    const products = await Product.find(filter)
      .sort(sortOptions)
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit))
      .select('name description price stockQuantity category brand images rating reviewCount inStock isActive');

    const total = await Product.countDocuments(filter);

    console.log(`✅ Found ${products.length} active products`);

    res.json({
      success: true,
      message: 'Products fetched successfully',
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      count: products.length
    });
  } catch (error: any) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// ✅ Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    console.log(`🏷️ Fetching products for category: ${category}`);
    
    const products = await Product.find({ 
      category,
      isActive: true,
      inStock: true
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      message: `Products in ${category} category`,
      products,
      category,
      count: products.length
    });
  } catch (error: any) {
    console.error('❌ Error fetching category products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category products',
      error: error.message
    });
  }
});

// ✅ Get single product details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Fetching product details: ${id}`);
    
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product details fetched',
      product
    });
  } catch (error: any) {
    console.error('❌ Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product details',
      error: error.message
    });
  }
});

// ✅ Search products
router.get('/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query required'
      });
    }

    console.log(`🔍 Searching products: ${q}`);
    
    const filter: any = {
      isActive: true,
      inStock: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    };

    if (category) filter.category = category;
    if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) };

    const products = await Product.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Search completed',
      products,
      query: q,
      count: products.length
    });
  } catch (error: any) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
});

// ✅ Get categories with product counts
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { isActive: true, inStock: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      message: 'Categories fetched',
      categories
    });
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

export default router;
