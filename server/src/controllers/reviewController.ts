// src/controllers/reviewController.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';
import Product from '../models/Product';
import Order from '../models/Order';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

/** Recompute and persist product rating metrics */
const recomputeProductRating = async (productId: string) => {
  const _id = new mongoose.Types.ObjectId(productId);

  const agg = await Review.aggregate([
    { $match: { productId: _id, status: 'approved' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const stats = agg[0] || { avg: 0, count: 0 };

  await Product.findByIdAndUpdate(_id, {
    averageRating: Math.round((stats.avg || 0) * 10) / 10,
    ratingsCount: stats.count || 0,
  });
};

/** Check if a user has bought the product (verified purchase) */
const userBoughtProduct = async (userId: string, productId: string) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const pid = new mongoose.Types.ObjectId(productId);

  // Match either user or userId (depends on your Order schema),
  // and consider paymentStatus/orderStatus commonly used values.
  const matchUser = {
    $or: [{ user: uid }, { userId: uid }],
  };

  const matchStatus = {
    $or: [
      { paymentStatus: { $in: ['paid', 'completed', 'success'] } },
      { orderStatus: { $in: ['delivered', 'completed'] } },
    ],
  };

  // Items may store product as productId or product
  const matchItem = {
    $or: [{ 'items.productId': pid }, { 'items.product': pid }],
  };

  const order = await Order.findOne({
    ...matchUser,
    ...matchStatus,
    ...matchItem,
  })
    .select('_id')
    .lean();

  return Boolean(order);
};

/** POST /api/reviews (create or update own review; only verified purchasers) */
export const upsertReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Login required' });
    }

    const { productId, rating, comment, title } = req.body || {};
    if (!productId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'productId, rating (1..5) and comment are required',
      });
    }

    // Ensure product exists (also capture productName)
    const product = await Product.findById(productId).select('name').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Only verified purchasers can post/update
    const hasBought = await userBoughtProduct(req.user.id, productId);
    if (!hasBought) {
      return res.status(403).json({
        success: false,
        message: 'Only verified purchasers can review this product',
      });
    }

    // Upsert: one review per (user, product)
    const review = await Review.findOneAndUpdate(
      { productId, userId: req.user.id },
      {
        $set: {
          productId: new mongoose.Types.ObjectId(productId),
          productName: product.name,
          userId: new mongoose.Types.ObjectId(req.user.id),
          userName: req.user.name || 'User',
          rating: Math.max(1, Math.min(5, Number(rating))),
          comment: comment.toString().trim(),
          // Your schema uses `verified`
          verified: true,
          // Auto-approve; change to 'pending' if you want moderation
          status: 'approved',
          // Optionally persist a short title inside comment (or extend schema if you want title field)
        },
        $setOnInsert: { reviewDate: new Date() },
      },
      { new: true, upsert: true }
    );

    await recomputeProductRating(productId);

    res.json({ success: true, message: 'Review saved', review });
  } catch (err: any) {
    console.error('❌ upsertReview error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to save review' });
  }
};

/** GET /api/reviews/products/:productId (public list) */
/** GET /api/reviews/products/:productId (public list) */
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const pageQ = req.query.page as string | undefined;
    const limitQ = req.query.limit as string | undefined;
    const sortQ = (req.query.sort as string | undefined) ?? 'new';

    // ✅ Explicit typing so Mongoose .sort() is happy
    let sortOpt: Record<string, 1 | -1>;
    if (sortQ === 'top') {
      sortOpt = { rating: -1, createdAt: -1 };
    } else if (sortQ === 'old') {
      sortOpt = { createdAt: 1 };
    } else {
      // 'new'
      sortOpt = { createdAt: -1 };
    }

    const p = Math.max(1, Number(pageQ ?? 1));
    const l = Math.min(50, Math.max(1, Number(limitQ ?? 10)));

    const pid = new mongoose.Types.ObjectId(productId);

    const [items, total] = await Promise.all([
      Review.find({ productId: pid, status: 'approved' })
        .sort(sortOpt)
        .skip((p - 1) * l)
        .limit(l)
        .select('-__v')
        .lean(),
      Review.countDocuments({ productId: pid, status: 'approved' }),
    ]);

    res.json({
      success: true,
      reviews: items,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
      },
    });
  } catch (err: any) {
    console.error('❌ getProductReviews error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch reviews' });
  }
};


/** GET /api/reviews/eligibility?productId=... (public; auth optional) */
export const checkEligibility = async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.query as { productId?: string };
    if (!productId) {
      return res.status(400).json({ success: false, eligible: false, message: 'productId required' });
    }

    if (!req.user) {
      return res.json({ success: true, eligible: false, reason: 'not_logged_in' });
    }

    const bought = await userBoughtProduct(req.user.id, productId);
    if (!bought) {
      return res.json({ success: true, eligible: false, reason: 'not_purchased' });
    }

    const existing = await Review.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      userId: new mongoose.Types.ObjectId(req.user.id),
    }).lean();

    return res.json({
      success: true,
      eligible: true,
      alreadyReviewed: Boolean(existing),
      review: existing || null,
    });
  } catch (err: any) {
    console.error('❌ checkEligibility error:', err);
    res.status(500).json({ success: false, eligible: false, message: err.message });
  }
};
