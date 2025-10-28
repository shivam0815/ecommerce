// src/routes/referral.ts
import { Router, Request, Response } from 'express';
import { userOrAdmin } from '../middleware/auth';
import Affiliate from '../models/Affiliate';
import AffiliateAttribution from '../models/AffiliateAttribution';
import AffiliatePayout from '../models/AffiliatePayout';

const router = Router();

router.get('/summary', userOrAdmin, async (req: Request, res: Response) => {
  const aff = await Affiliate.findOne({ userId: (req as any).user.id }).lean();
  if (!aff) return res.json({ active: false });

  const payouts = await AffiliatePayout.find({ affiliateId: aff._id })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  res.json({
    code: aff.code,
    monthKey: aff.monthKey,
    monthOrders: aff.monthOrders,
    monthSales: aff.monthSales,
    monthCommissionAccrued: aff.monthCommissionAccrued,
    lifetimeSales: aff.lifetimeSales,
    lifetimeCommission: aff.lifetimeCommission,
    rules: aff.rules,
    payouts,
  });
});

router.get('/history', userOrAdmin, async (req: Request, res: Response) => {
  const { month, status, limit = 200 } = req.query;
  const aff = await Affiliate.findOne({ userId: (req as any).user.id }).lean();
  if (!aff) return res.json({ data: [] });

  const q: any = { affiliateId: aff._id };
  if (month) q.monthKey = month;
  if (status) q.status = status;

  const rows = await AffiliateAttribution.find(q)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json({ data: rows });
});

router.post('/request-payout', userOrAdmin, async (req: Request, res: Response) => {
  const { monthKey } = req.body || {};
  const aff = await Affiliate.findOne({ userId: (req as any).user.id });
  if (!aff) return res.status(400).json({ error: 'not_affiliate' });

  const sum = await AffiliateAttribution.aggregate([
    { $match: { affiliateId: aff._id, monthKey, status: 'locked' } },
    { $group: { _id: null, amount: { $sum: '$commissionAmount' } } },
  ]);
  const amount = sum?.[0]?.amount || 0;
  if (amount <= 0) return res.status(400).json({ error: 'nothing_to_pay' });

  await AffiliatePayout.updateOne(
    { affiliateId: aff._id, monthKey },
    { $setOnInsert: { amount, status: 'requested' } },
    { upsert: true }
  );

  res.json({ ok: true });
});

export default router;
