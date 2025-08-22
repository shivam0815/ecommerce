// backend/src/controllers/reviewController.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';
import Product from '../models/Product';

const recalcProductRating = async (productId: mongoose.Types.ObjectId | string) => {
  const agg = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(String(productId)), status: 'approved' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  const avg = agg[0]?.avg ?? 0;
  const count = agg[0]?.count ?? 0;

  await Product.findByIdAndUpdate(
    productId,
    { rating: Math.round(avg * 10) / 10, reviewsCount: count },
    { new: false }
  );
};

export const listReviews = async (req: Request, res: Response) => {
  try {
    const { productId, page = 1, limit = 10 } = req.query as any;
    if (!productId) return res.status(400).json({ success: false, message: 'productId required' });

    const p = Math.max(1, Number(page));
    const l = Math.max(1, Math.min(50, Number(limit)));
    const skip = (p - 1) * l;

    const [items, total, summary] = await Promise.all([
      Review.find({ productId, status: 'approved' }).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      Review.countDocuments({ productId, status: 'approved' }),
      Review.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(String(productId)), status: 'approved' } },
        { $group: { _id: '$rating', count: { $sum: 1 } } }
      ])
    ]);

    const dist: Record<string, number> = { '1':0,'2':0,'3':0,'4':0,'5':0 };
    summary.forEach((s: any) => { dist[String(s._id)] = s.count; });

    res.json({
      success: true,
      reviews: items,
      pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
      distribution: dist
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || 'Failed to fetch reviews' });
  }
};

// controllers/reviewController.ts
export const createReview = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as any;          // 👈 defensive
    const { productId, rating, comment, title, userName, userEmail } = body;

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Valid productId required' });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'rating must be 1..5' });
    }
    if (!comment || String(comment).trim().length < 5) {
      return res.status(400).json({ success: false, message: 'comment is too short' });
    }

    const doc = await Review.create({
      productId,
      rating,
      comment: String(comment).trim(),
      title,
      userId: (req as any).user?._id,
      userName: (req as any).user?.name || userName,
      userEmail: (req as any).user?.email || userEmail,
      status: 'pending',
      verified: false,
    });

    return res.status(201).json({ success: true, message: 'Review submitted for approval', review: doc });
  } catch (e: any) {
    console.error('❌ createReview error:', e);
    return res.status(500).json({ success: false, message: e.message || 'Failed to create review' });
  }
};


/** When admin flips status -> keep product aggregates fresh */
export const recomputeOnStatusChange = async (reviewId: string) => {
  const r = await Review.findById(reviewId).lean();
  if (r?.productId) await recalcProductRating(r.productId);
};
