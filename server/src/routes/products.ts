// src/routes/products.routes.ts
import express from 'express';
import mongoose, { SortOrder } from 'mongoose';
import Product from '../models/Product';
import NodeCache from 'node-cache';

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Utils                                                              */
/* ------------------------------------------------------------------ */
const toNumber = (v: any, d: number) => (v == null || v === '' ? d : Number(v));
const isNonEmpty = (v: any) => typeof v === 'string' && v.trim() !== '';

/** Build an absolute image URL that the FE can always use */
function pickImage(p: any, base = 'https://nakodamobile.in') {
  // Prefer primaryImage (string/object) then images[0] (string/object)
  const prim = p?.primaryImage;
  const first = Array.isArray(p?.images) ? p.images[0] : undefined;

  let url: any =
    (typeof prim === 'string' ? prim : prim?.url || prim?.secure_url) ||
    (typeof first === 'string' ? first : first?.url || first?.secure_url) ||
    null;

  // Normalize /uploads/* → absolute
  if (url && typeof url === 'string' && url.startsWith('/uploads/')) {
    url = `${base}${url}`;
  }
  return url;
}

/** Slim fields for list responses (detail route returns full doc) */
const LIST_FIELDS =
  'name slug price mrp category brand images.0 primaryImage averageRating ratingsCount stockQuantity inStock isActive createdAt updatedAt';

/** Small 30s cache for hot first-page queries */
const listCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

/** FE sort tokens → Mongo sort */
const sortMap: Record<string, Record<string, SortOrder>> = {
  createdAt: { createdAt: -1 },
  price: { price: 1 }, // flips with order
  rating: { averageRating: -1, ratingsCount: -1 },
  trending: { trendingScore: -1, updatedAt: -1, createdAt: -1 },
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
    if (keys.length === 1) obj[keys[0]] = ord;
    return obj;
  }
  return { createdAt: -1 };
}

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

/**
 * GET /products/search?q=...&category=...&minPrice=...&maxPrice=...
 * Uses $text when index exists, else regex fallback.
 */
router.get('/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query as Record<string, string>;
    if (!isNonEmpty(q)) return res.status(400).json({ success: false, message: 'Search query required' });

    const filter: any = { isActive: true };
    if (isNonEmpty(category) && category !== 'all') filter.category = category;
    if (minPrice) filter.price = { ...(filter.price || {}), $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...(filter.price || {}), $lte: Number(maxPrice) };

    res.set('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');

    // Detect if any text index exists on the schema
    const hasText =
      typeof (Product.schema as any).indexes === 'function' &&
      (Product.schema as any).indexes().some((idx: any[]) =>
        Object.values(idx?.[0] || {}).includes('text')
      );

    let items: any[] = [];
    if (hasText) {
      filter.$text = { $search: q!.trim() };
      const query = Product.find(filter)
        // @ts-ignore add score
        .select({ ...LIST_FIELDS.split(' ').reduce((p, f) => ({ ...p, [f]: 1 }), {}), score: { $meta: 'textScore' } })
        // @ts-ignore sort by score then newest
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(48)
        .lean();
      items = await query.exec();
    } else {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
      items = await Product.find(filter).select(LIST_FIELDS).sort({ createdAt: -1, _id: -1 }).limit(48).lean();
    }

    const products = items.map(p => ({ ...p, thumbnail: pickImage(p) }));
    res.json({ success: true, products, count: products.length, query: q });
  } catch (error: any) {
    console.error('❌ /products/search error:', error);
    res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
});

/** GET /products/categories */
router.get('/categories', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120');
    const categories = await Product.distinct('category', { isActive: true });
    res.json({ success: true, categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

/** GET /products/categories/list */
router.get('/categories/list', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120');
    const categories = await Product.aggregate([
      { $match: { isActive: true, inStock: { $ne: false } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, categories });
  } catch (error: any) {
    console.error('❌ /products/categories/list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

/** GET /products/trending?limit=12 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = '12' } = req.query as Record<string, string>;
    const l = Math.min(48, Math.max(1, Number(limit) || 12));

    res.set('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const results = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          _rating: { $ifNull: ['$averageRating', 0] },
          _reviews: { $ifNull: ['$ratingsCount', 0] },
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
      { $project: LIST_FIELDS.split(' ').reduce((p, f) => ({ ...p, [f]: 1 }), {}) },
    ]);

    const products = results.map(p => ({ ...p, thumbnail: pickImage(p) }));
    res.json({ success: true, products, count: products.length });
  } catch (error: any) {
    console.error('❌ /products/trending error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending products', error: error.message });
  }
});

/** GET /products/brand/:brand?limit=12&excludeId=... */
router.get('/brand/:brand', async (req, res) => {
  try {
    const { brand } = req.params;
    const { limit = '12', excludeId } = req.query as Record<string, string>;
    const l = Math.min(48, Math.max(1, Number(limit) || 12));

    res.set('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');

    const filter: any = { brand, isActive: true };
    if (excludeId && mongoose.isValidObjectId(excludeId)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const items = await Product.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(l)
      .select(LIST_FIELDS)
      .lean();

    const products = items.map(p => ({ ...p, thumbnail: pickImage(p) }));
    res.json({ success: true, products, count: products.length });
  } catch (error: any) {
    console.error('❌ /products/brand error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brand products', error: error.message });
  }
});

/** GET /products/category/:category */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;

    res.set('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');

    const items = await Product.find({ category, isActive: true })
      .sort({ createdAt: -1, _id: -1 })
      .select(LIST_FIELDS)
      .lean();

    const products = items.map(p => ({ ...p, thumbnail: pickImage(p) }));
    res.json({ success: true, products, count: products.length, category });
  } catch (error: any) {
    console.error('❌ /products/category error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category products', error: error.message });
  }
});

/** GET /products/:id/related?limit=12 */
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '12' } = req.query as Record<string, string>;
    const l = Math.min(48, Math.max(1, Number(limit) || 12));

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id format' });
    }

    res.set('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');

    const base = await Product.findById(id).select('category brand').lean();
    if (!base) return res.status(404).json({ success: false, message: 'Base product not found' });

    const filter: any = {
      _id: { $ne: new mongoose.Types.ObjectId(id) },
      isActive: true,
      $or: [{ category: base.category }, { brand: base.brand }],
    };

    const items = await Product.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(l)
      .select(LIST_FIELDS)
      .lean();

    const products = items.map(p => ({ ...p, thumbnail: pickImage(p) }));
    res.json({ success: true, products, count: products.length });
  } catch (error: any) {
    console.error('❌ /products/:id/related error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch related products', error: error.message });
  }
});

/** GET /products/:id (single) */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id format' });
    }

    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');

    const product: any = await Product.findById(id).select('-__v').lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    product.thumbnail = pickImage(product);
    res.json({ success: true, product });
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
      order = 'desc',
      page = '1',
      limit,
      minPrice,
      maxPrice,
      excludeId,
      sortOrder,
    } = req.query as Record<string, string>;

    const p = Math.max(1, toNumber(page, 1));
    const DEFAULT_LIMIT = 24;
    const MAX_LIMIT = 48;
    const l = Math.min(MAX_LIMIT, Math.max(1, toNumber(limit, DEFAULT_LIMIT)));
    const effOrder = sortOrder ?? order;

    const filter: any = { isActive: true };
    if (isNonEmpty(category) && category !== 'all') filter.category = category;
    if (isNonEmpty(brand) && brand !== 'all') filter.brand = brand;
    if (excludeId && mongoose.isValidObjectId(excludeId)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Prefer text search when available
    if (isNonEmpty(search)) {
      filter.$text = { $search: search!.trim() };
    }

    // Trending path via aggregation
    const sort = getSort(sortBy, effOrder);
    if (sortBy === 'trending') {
      res.set('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [results, totalAgg] = await Promise.all([
        Product.aggregate([
          { $match: filter },
          {
            $addFields: {
              _rating: { $ifNull: ['$averageRating', 0] },
              _reviews: { $ifNull: ['$ratingsCount', 0] },
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
          { $project: LIST_FIELDS.split(' ').reduce((p, f) => ({ ...p, [f]: 1 }), {}) },
        ]),
        Product.countDocuments(filter),
      ]);

      const products = results.map(p => ({ ...p, thumbnail: pickImage(p) }));
      return res.json({
        success: true,
        products,
        pagination: { page: p, limit: l, total: totalAgg, pages: Math.ceil(totalAgg / l), hasMore: p * l < totalAgg },
        count: products.length,
      });
    }

    // Normal list path with small cache for page 1 without search
    res.set('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');

    const canCache = !isNonEmpty(search) && p === 1;
    const cacheKey = canCache ? `plist:${category || 'all'}:${brand || 'all'}:${sortBy}:${effOrder}:${l}` : null;
    if (cacheKey) {
      const hit = listCache.get(cacheKey);
      if (hit) return res.json(hit as any);
    }

    const q = Product.find(filter).select(LIST_FIELDS).sort(sort).skip((p - 1) * l).limit(l).lean();

    if (filter.$text) {
      // @ts-ignore
      q.select({ score: { $meta: 'textScore' } });
      // @ts-ignore
      q.sort({ score: { $meta: 'textScore' }, ...sort });
    }

    const needCount = p === 1 && !filter.$text;
    const [items, total] = await Promise.all([
      q.exec(),
      needCount ? Product.countDocuments(filter) : Promise.resolve(undefined),
    ]);

    const products = items.map(p => ({ ...p, thumbnail: pickImage(p) }));
    const payload = {
      success: true,
      products,
      pagination: {
        page: p,
        limit: l,
        total: total ?? undefined,
        pages: total ? Math.ceil(total / l) : undefined,
        hasMore: total ? p * l < total : true,
      },
      count: products.length,
    };

    if (cacheKey) listCache.set(cacheKey, payload);
    res.json(payload);
  } catch (error: any) {
    console.error('❌ GET /products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message });
  }
});

export default router;
