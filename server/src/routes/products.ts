// products.routes.ts
import express from 'express';
import mongoose, { SortOrder } from 'mongoose';
import Product from '../models/Product';

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */
const toNumber = (v: any, d: number) => (v == null || v === '' ? d : Number(v));
const isNonEmpty = (v: any) => typeof v === 'string' && v.trim() !== '';

/** Translate FE sort tokens to Mongo sort objects */
const sortMap: Record<string, Record<string, SortOrder>> = {
  createdAt: { createdAt: -1 },
  price: { price: 1 },                                   // will flip with `order`
  rating: { rating: -1, reviews: -1 },
  trending: { trendingScore: -1, updatedAt: -1, createdAt: -1 }, // for aggregate
};

function getSort(
  sortBy?: string | string[],
  order?: string | string[]
): Record<string, SortOrder> {
  const sb = Array.isArray(sortBy) ? sortBy[0] : sortBy;
  const ord: SortOrder = (Array.isArray(order) ? order[0] : order) === 'asc' ? 1 : -1;

  if (sb && sortMap[sb]) {
    const obj = { ...sortMap[sb] };
    const keys = Object.keys(obj);
    if (keys.length === 1) obj[keys[0]] = ord; // only flip single-key sorts
    return obj;
  }
  return { createdAt: -1 };
}


/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

/**
 * GET /products/search?q=...&category=...&minPrice=...&maxPrice=...
 */
router.get('/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query as Record<string, string>;

    if (!isNonEmpty(q)) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const filter: any = {
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ],
    };

    if (isNonEmpty(category) && category !== 'all') filter.category = category;
    if (minPrice) filter.price = { ...(filter.price || {}), $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...(filter.price || {}), $lte: Number(maxPrice) };

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .select(
        'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
      )
      .lean();

    res.json({
      success: true,
      message: 'Search completed',
      products,
      query: q,
      count: products.length,
    });
  } catch (error: any) {
    console.error('❌ /products/search error:', error);
    res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
});

/**
 * GET /products/categories  → distinct category names
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
 * GET /products/categories/list  → categories with counts
 */
router.get('/categories/list', async (_req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { isActive: true, inStock: { $ne: false } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, message: 'Categories fetched', categories });
  } catch (error: any) {
    console.error('❌ /products/categories/list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

/**
 * GET /products/trending?limit=12
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = '12' } = req.query as Record<string, string>;
    const l = Math.min(1000, Math.max(1, Number(limit) || 12));

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const results = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          _rating: { $ifNull: ['$rating', 0] },
          _reviews: { $ifNull: ['$reviews', 0] },
          _recent: { $cond: [{ $gte: ['$updatedAt', thirtyDaysAgo] }, 1, 0] },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $add: [{ $multiply: ['$_rating', '$_reviews'] }, { $multiply: ['$_recent', 10] }],
          },
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
    console.error('❌ /products/trending error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending products', error: error.message });
  }
});

/**
 * GET /products/brand/:brand?limit=12&excludeId=...
 */
router.get('/brand/:brand', async (req, res) => {
  try {
    const { brand } = req.params;
    const { limit = '12', excludeId } = req.query as Record<string, string>;

    const filter: any = { brand, isActive: true };
    if (excludeId) filter._id = { $ne: excludeId };

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(1000, Math.max(1, Number(limit) || 12)))
      .select(
        'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
      )
      .lean();

    res.json({ success: true, message: `Products in brand ${brand}`, products, count: products.length });
  } catch (error: any) {
    console.error('❌ /products/brand error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brand products', error: error.message });
  }
});

/**
 * GET /products/category/:category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;

    const products = await Product.find({ category, isActive: true })
      .sort({ createdAt: -1 })
      .select(
        'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
      )
      .lean();

    res.json({
      success: true,
      message: `Products in ${category} category`,
      products,
      category,
      count: products.length,
    });
  } catch (error: any) {
    console.error('❌ /products/category error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category products', error: error.message });
  }
});

/**
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
      $or: [{ category: base.category }, { brand: base.brand }],
    };

    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .limit(Math.min(1000, Math.max(1, Number(limit) || 12)))
      .select(
        'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
      )
      .lean();

    res.json({ success: true, message: 'Related products', products, count: products.length });
  } catch (error: any) {
    console.error('❌ /products/:id/related error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch related products', error: error.message });
  }
});

/**
 * GET /products/:id  (single)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id format' });
    }

    const product = await Product.findById(id).select('-__v').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product details fetched', product });
  } catch (error: any) {
    console.error('❌ /products/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product details', error: error.message });
  }
});

/**
 * GET /products
 * Query:
 *  - category, brand, search, minPrice, maxPrice, excludeId
 *  - sortBy (createdAt|price|rating|trending), order (asc|desc)
 *  - page, limit
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      brand,
      search,
      sortBy = 'createdAt',
      order = 'desc',              // FE may send 'sortOrder'
      page = '1',
      limit,                       // let clamp handle default
      minPrice,
      maxPrice,
      excludeId,
      sortOrder,                   // accept alias
    } = req.query as Record<string, string>;

    const p = Math.max(1, toNumber(page, 1));
    const MAX_LIMIT = 1000;
    const DEFAULT_LIMIT = 200;
    const l = Math.min(MAX_LIMIT, Math.max(1, toNumber(limit, DEFAULT_LIMIT)));

    const filter: any = { isActive: true };

    if (isNonEmpty(category) && category !== 'all') filter.category = category;
    if (isNonEmpty(brand) && brand !== 'all') filter.brand = brand;
    if (excludeId) filter._id = { $ne: excludeId };

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (isNonEmpty(search)) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // If trending, do the aggregate path FIRST and return
    const effOrder = sortOrder ?? order;
    if (sortBy === 'trending') {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [results, totalAgg] = await Promise.all([
        Product.aggregate([
          { $match: filter },
          {
            $addFields: {
              _rating: { $ifNull: ['$rating', 0] },
              _reviews: { $ifNull: ['$reviews', 0] },
              _recent: { $cond: [{ $gte: ['$updatedAt', thirtyDaysAgo] }, 1, 0] },
            },
          },
          {
            $addFields: {
              trendingScore: {
                $add: [{ $multiply: ['$_rating', '$_reviews'] }, { $multiply: ['$_recent', 10] }],
              },
            },
          },
          { $sort: { trendingScore: -1, updatedAt: -1, createdAt: -1 } },
          { $skip: (p - 1) * l },
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
            },
          },
        ]),
        Product.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        message: 'Products fetched successfully (trending)',
        products: results,
        pagination: {
          page: p,
          limit: l,
          total: totalAgg,
          pages: Math.ceil(totalAgg / l),
          hasMore: p * l < totalAgg,
        },
        count: results.length,
      });
    }

    // Normal find() path
    const sort = getSort(sortBy, effOrder);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip((p - 1) * l)
        .limit(l)
        .select(
          'name description price stockQuantity category brand images rating reviews inStock isActive specifications createdAt updatedAt'
        )
        .lean(),
      Product.countDocuments(filter),
    ]);

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
    console.error('❌ GET /products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message });
  }
});

export default router;
