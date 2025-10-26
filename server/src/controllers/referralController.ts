// src/controllers/referralController.ts
import { Request, Response } from 'express';
import ReferralClick from '../models/ReferralClick';
import ReferralCommission from '../models/ReferralCommission';

/**
 * GET /referral/summary
 * Requires logged-in user (req.user._id)
 */
export const getReferralSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const clicks = await ReferralClick.countDocuments({ refUserId: userId });
    const commissions = await ReferralCommission.aggregate([
      { $match: { refUserId: userId } },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const map: Record<string, number> = { pending: 0, approved: 0, paid: 0 };
    for (const c of commissions) map[c._id] = c.total;

    return res.json({
      clicks,
      pending: map.pending,
      approved: map.approved,
      paid: map.paid,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load referral summary' });
  }
};

/**
 * GET /referral/history
 */
export const getReferralHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const list = await ReferralCommission.find({ refUserId: userId })
      .populate('buyerUserId', 'name email')
      .populate('orderId', 'orderNumber total')
      .sort({ createdAt: -1 });

    res.json({ items: list });
  } catch {
    res.status(500).json({ message: 'Failed to load history' });
  }
};
