// products.routes.ts
import express from 'express';
import mongoose, { SortOrder } from 'mongoose';
import Product from '../models/Product';

const router = express.Router();

/* ----------------------------- Utilities ----------------------------- */
const toNumber = (v: any, d: number) => (v == null ? d : Number(v));
const isNonEmpty = (v: any) => typeof v === 'string' && v.trim() !== '';

/** Sort map: translate sortBy tokens from FE to Mongo sort */
const sortMap: Record<string, Record<string, SortOrder>> = {
  createdAt: { createdAt: -1 },
  price: { price: 1 }, // will flip via order when single-key
  rating: { rating: -1, reviews: -1 },
  trending: { trendingScore: -1, updatedAt: -1, createdAt: -1 }, // if you persist trendingScore
};

function getSort(
  sortBy?: string | string[],
  order?: string | string[]
): Record<string, SortOrder> {
  const sb = Array.isArray(sortBy) ? sortBy[0] : sortBy;
  const ord: SortOrder = (Array.isArray(order) ? order[0] : order) === 'asc' ? 1 : -1;

  if (sb && sortMap[sb]) {
    const obj = { ...sortMap[sb] }; // Record<string, SortOrder>
    const keys = Object.keys(obj);
    if (keys.length === 1) obj[keys[0]] = ord; // flip when only one key present
    return obj;
  }
  return { createdAt: -1 };
}

/* ------------------------------ Routes ------------------------------ */
/**
 * ✅ Search products (static path placed BEFORE `/:id`)
 * GET /products/search?q=...&category=...&minPrice=...&maxPrice=...
 */
router.get('/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query as Record<string, string>;

    if (!isNonEmpty(q)) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    console.log(`🔍 Searching products: ${q}`);

    const filter: any = {
      isActive: true,
      inStock: true,
      $or: [{ name: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }],
    };

    if (isNonEmpty(category)) filter.category = category;
    if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) };

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .select(
        'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
      )
      .lean();

    res.json({ success: true, message: 'Search completed', products, query: q, count: products.length });
  } catch (error: any) {
    console.error('❌ Search error:', error);
    res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
});

/**
 * ✅ Categories (simple list) — matches FE productService.getCategories()
 * GET /products/categories
 */
router.get('/categories', async (_req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json({ success: true, categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

/**
 * ✅ Categories with counts
 * GET /products/categories/list
 */
router.get('/categories/list', async (_req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { isActive: true, inStock: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, message: 'Categories fetched', categories });
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

/**
 * ✅ Trending products (for rails)
 * GET /products/trending?limit=12
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = '12' } = req.query as Record<string, string>;
    const l = toNumber(limit, 12);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const results = await Product.aggregate([
      { $match: { isActive: true, inStock: true } },
      {
        $addFields: {
          _rating: { $ifNull: ['$rating', 0] },
          _reviews: { $ifNull: ['$reviews', 0] },
          _recent: { $cond: [{ $gte: ['$updatedAt', thirtyDaysAgo] }, 1, 0] },
        },
      },
      {
        $addFields: {
          trendingScore: { $add: [{ $multiply: ['$_rating', '$_reviews'] }, { $multiply: ['$_recent', 10] }] },
        },
      },
      { $sort: { trendingScore: -1, updatedAt: -1, createdAt: -1 } },
      { $limit: l },
      {
        $project: {
          name: 1,
          description: 1,
          price: 1,
          stockQuantity: 1,
          category: 1,
          brand: 1,
          images: 1,
          rating: 1,
          reviews: 1,
          inStock: 1,
          isActive: 1,
          specifications: 1,
          createdAt: 1,
          updatedAt: 1,
          trendingScore: 1,
        },
      },
    ]);

    res.json({ success: true, message: 'Trending products', products: results, count: results.length });
  } catch (error: any) {
    console.error('❌ Error fetching trending products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending products', error: error.message });
  }
});

/**
 * ✅ Products by brand (for rails)
 * GET /products/brand/:brand?limit=12&excludeId=...
 */
router.get('/brand/:brand', async (req, res) => {
  try {
    const { brand } = req.params;
    const { limit = '12', excludeId } = req.query as Record<string, string>;
    console.log(`🏷️ Fetching products for brand: ${brand}`);

    const filter: any = { brand, isActive: true };
    if (excludeId) filter._id = { $ne: excludeId };

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(toNumber(limit, 12))
      .select(
        'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
      )
      .lean();

    res.json({ success: true, message: `Products in brand ${brand}`, products, count: products.length });
  } catch (error: any) {
    console.error('❌ Error fetching brand products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brand products', error: error.message });
  }
});

/**
 * ✅ Products by category (alias; keeps your previous behavior)
 * GET /products/category/:category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`🏷️ Fetching products for category: ${category}`);

    const products = await Product.find({ category, isActive: true, inStock: true })
      .sort({ createdAt: -1 })
      .select(
        'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
      )
      .lean();

    res.json({ success: true, message: `Products in ${category} category`, products, category, count: products.length });
  } catch (error: any) {
    console.error('❌ Error fetching category products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category products', error: error.message });
  }
});

/**
 * ✅ Related products by product id (for rails)
 * GET /products/:id/related?limit=12
 */
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '12' } = req.query as Record<string, string>;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id format' });
    }

    const base = await Product.findById(id).select('category brand').lean();
    if (!base) return res.status(404).json({ success: false, message: 'Base product not found' });

    const filter: any = {
      _id: { $ne: id },
      isActive: true,
      inStock: true,
      $or: [{ category: base.category }, { brand: base.brand }],
    };

    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .limit(toNumber(limit, 12))
      .select(
        'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
      )
      .lean();

    res.json({ success: true, message: 'Related products', products, count: products.length });
  } catch (error: any) {
    console.error('❌ Error fetching related products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch related products', error: error.message });
  }
});

/**
 * ✅ Single product (used by FE productService.getProduct)
 * GET /products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id format' });
    }

    console.log(`🔍 Fetching product details: ${id}`);

    const product = await Product.findById(id).select('-__v').lean(); // includes specifications
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product details fetched', product });
  } catch (error: any) {
    console.error('❌ Error fetching product details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product details', error: error.message });
  }
});

/**
 * ✅ Index (active products with filters/paging/sorting)
 * GET /products?category=&brand=&search=&sortBy=&order=&page=&limit=&minPrice=&maxPrice=&excludeId=
 */
router.get('/', async (req, res) => {
  try {
    console.log('🛍️ Fetching all products for users...');

    const {
      category,
      brand,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      page = '1',
      limit = '50',
      minPrice,
      maxPrice,
      excludeId,
    } = req.query as Record<string, string>;

    const p = Math.max(1, toNumber(page, 1));
    const l = Math.min(200, Math.max(1, toNumber(limit, 50)));

    const filter: any = { isActive: true, status: 'active' };

    if (isNonEmpty(category) && category !== 'all') filter.category = category;
    if (isNonEmpty(brand) && brand !== 'all') filter.brand = brand;
    if (excludeId) filter._id = { $ne: excludeId };

    // Price band
    if (minPrice || maxPrice) {
      filter.price = {} as any;
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Basic search
    if (isNonEmpty(search)) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const sort = getSort(sortBy, order);

    // Efficient paging
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort) // typed as Record<string, SortOrder>
        .skip((p - 1) * l)
        .limit(l)
        .select(
          'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
        )
        .lean(),
      Product.countDocuments(filter),
    ]);
// inside router.get('/', async (req, res) => { ... })
if (sortBy === 'trending') {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const matchStage: any = { ...filter }; // reuse your filter
  // Remove fields not valid in $match on aggregate (arrays/regex fine, but _id: {$ne: ...} is fine too)
  const [results, totalAgg] = await Promise.all([
    Product.aggregate([
      { $match: matchStage },
      { $addFields: {
          _rating: { $ifNull: ['$rating', 0] },
          _reviews: { $ifNull: ['$reviews', 0] },
          _recent: { $cond: [{ $gte: ['$updatedAt', thirtyDaysAgo] }, 1, 0] },
        } },
      { $addFields: { trendingScore: { $add: [{ $multiply: ['$_rating', '$_reviews'] }, { $multiply: ['$_recent', 10] }] } } },
      { $sort: { trendingScore: -1, updatedAt: -1, createdAt: -1 } },
      { $skip: (p - 1) * l },
      { $limit: l },
      { $project: {
          name: 1, description: 1, price: 1, stockQuantity: 1, category: 1, brand: 1, images: 1,
          rating: 1, reviews: 1, inStock: 1, isActive: 1, specifications: 1, createdAt: 1, updatedAt: 1
        } },
    ]),
    Product.countDocuments(matchStage),
  ]);

  return res.json({
    success: true,
    message: 'Products fetched successfully',
    products: results,
    pagination: { page: p, limit: l, total: totalAgg, pages: Math.ceil(totalAgg / l), hasMore: p * l < totalAgg },
    count: results.length,
  });
}

    console.log(`✅ Found ${products.length} active products`);

    res.json({
      success: true,
      message: 'Products fetched successfully',
      products,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
        hasMore: p * l < total,
      },
      count: products.length,
    });
  } catch (error: any) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message });
  }
});

export default router;
