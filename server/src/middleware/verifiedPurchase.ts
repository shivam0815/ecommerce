// middleware/verifiedPurchase.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';

// Checks if the authenticated user purchased the product in :productId
// Sets (req as any).isVerifiedPurchase = true/false
export const hasPurchasedProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const aReq = req as any;
    if (!aReq.user?._id) {
      (req as any).isVerifiedPurchase = false;
      return next();
    }

    const productIdParam = (req.params as any).productId || (req.query as any).productId;
    if (!productIdParam) {
      (req as any).isVerifiedPurchase = false;
      return next();
    }

    const uid = new mongoose.Types.ObjectId(aReq.user._id);
    const pid = new mongoose.Types.ObjectId(productIdParam);

    const matchUser = { $or: [{ user: uid }, { userId: uid }] };
    const matchStatus = {
      $or: [
        { paymentStatus: { $in: ['paid', 'completed', 'success'] } },
        { orderStatus: { $in: ['delivered', 'completed'] } },
      ],
    };
    const matchItem = { $or: [{ 'items.productId': pid }, { 'items.product': pid }] };

    const order = await Order.findOne({ ...matchUser, ...matchStatus, ...matchItem })
      .select('_id')
      .lean();

    (req as any).isVerifiedPurchase = Boolean(order);
    return next();
  } catch (err) {
    console.error('hasPurchasedProduct err:', err);
    (req as any).isVerifiedPurchase = false;
    return next();
  }
};
