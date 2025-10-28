// src/routes/referral.ts
import { Router, Request, Response } from 'express';
import { userOrAdmin } from '../middleware/auth';
import User from '../models/User';
import Affiliate from '../models/Affiliate';
import AffiliateAttribution from '../models/AffiliateAttribution';
import AffiliatePayout from '../models/AffiliatePayout';

const router = Router();

const monthKeyOf = (d = new Date()) => d.toISOString().slice(0, 7);
const defaultRules = { tiers: [{ min: 0, rate: 0.01 }] };

router.get('/summary', userOrAdmin, async (req: Request, res: Response) => {
  const requesterId = (req as any).user.id;

  let aff = await Affiliate.findOne({ userId: requesterId });
  if (!aff) {
    const u = await User.findById(requesterId); // no .lean()
    if (!u?.referralCode) return res.json({ active: false });

    aff = await Affiliate.create({
      userId: u._id,
      code: u.referralCode,
      monthKey: monthKeyOf(),
      monthOrders: 0,
      monthSales: 0,
      monthCommissionAccrued: 0,
      lifetimeSales: 0,
      lifetimeCommission: 0,
      rules: defaultRules,
    });
  }

  const payouts = await AffiliatePayout.find({ affiliateId: aff._id })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  res.json({
    active: true,
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
  const { month, status, limit = 200 } = req.query as any;

  const aff = await Affiliate.findOne({ userId: (req as any).user.id });
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
