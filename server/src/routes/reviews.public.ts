import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { body, param, query, validationResult } from 'express-validator';

import Review from '../models/Review';
import Product from '../models/Product';
import { authenticate } from '../middleware/auth';   // must attach req.user with {_id, name, ...}
import { hasPurchasedProduct } from '../middleware/verifiedPurchase';

const r = Router();

// GET all APPROVED reviews for a product (public)
// supports ?page=&limit=&sort=top|new|old
r.get(
  '/api/products/:productId/reviews',
  param('productId').isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('sort').optional().isIn(['top', 'new', 'old']),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const productId = new mongoose.Types.ObjectId(req.params.productId);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const sort = (req.query.sort as string) || 'new';

      // ✅ Build sort object with explicit type to satisfy TS
      let sortOpt: Record<string, 1 | -1>;
      if (sort === 'top') {
        sortOpt = { rating: -1, createdAt: -1 };
      } else if (sort === 'old') {
        sortOpt = { createdAt: 1 };
      } else {
        // 'new'
        sortOpt = { createdAt: -1 };
      }

      const [data, total] = await Promise.all([
        Review.find({ productId, status: 'approved' })
          .sort(sortOpt)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Review.countDocuments({ productId, status: 'approved' }),
      ]);

      return res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err: any) {
      console.error('reviews.list err:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// POST create/update a user’s review (auth + verified purchase enforced)
// New/updated reviews go to moderation (status: 'pending') — change to 'approved' if you want auto-publish.
r.post(
  '/api/products/:productId/reviews',
  authenticate,
  param('productId').isMongoId(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString(),
  hasPurchasedProduct, // sets (req as any).isVerifiedPurchase
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const productObjectId = new mongoose.Types.ObjectId(req.params.productId);
      const aReq = req as any;

      // must have verified purchase
      if (!aReq.isVerifiedPurchase) {
        return res.status(403).json({
          success: false,
          message: 'Only verified purchasers can review this product',
        });
      }

      // fetch product name from DB (don’t trust client body)
      const product = await Product.findById(productObjectId).select('name').lean();
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const doc = await Review.findOneAndUpdate(
        { productId: productObjectId, userId: aReq.user._id },
        {
          $set: {
            productId: productObjectId,
            productName: product.name || '',
            userId: aReq.user._id,
            userName: aReq.user.name || 'User',
            rating: Number((req.body as any).rating),
            comment: ((req.body as any).comment || '').toString().trim(),
            verified: true,
            status: 'pending', // moderation step; change to 'approved' if you want immediate publish
            reviewDate: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      return res.status(201).json({ success: true, data: doc });
    } catch (err: any) {
      console.error('reviews.upsert err:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// (Optional) mark helpful (+1) — authenticated users only
r.post(
  '/api/reviews/:id/helpful',
  authenticate,
  param('id').isMongoId(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      await Review.findByIdAndUpdate(req.params.id, { $inc: { helpful: 1 } });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('reviews.helpful err:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

export default r;
