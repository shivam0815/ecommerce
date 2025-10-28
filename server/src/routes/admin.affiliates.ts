// src/routes/admin.affiliates.ts
import { Router, Request, Response } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';
import { Types } from 'mongoose';
import Affiliate from '../models/Affiliate';
import AffiliateAttribution from '../models/AffiliateAttribution';
import AffiliatePayout from '../models/AffiliatePayout';
import User from '../models/User';

const router = Router();
const secureAdminOnly = [authenticate, adminOnly] as const;
const oid = (v: string) => new Types.ObjectId(String(v));

/* --------- Affiliates list with metrics --------- */
router.get('/affiliates', ...secureAdminOnly, async (req: Request, res: Response) => {
  const { page = 1, limit = 20, q = '' } = req.query as { page?: any; limit?: any; q?: string };

  let affMatch: any = {};
  if (q) {
    const users = await User.find({
      $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }],
    })
      .select('_id')
      .lean();

    if (users.length) affMatch.userId = { $in: users.map((u) => u._id) };
    else affMatch.code = { $regex: q, $options: 'i' };
  }

  const [rows, total] = await Promise.all([
    Affiliate.aggregate([
      { $match: affMatch },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      {
        $project: {
          _id: 1,
          userId: 1,
          code: 1,
          monthKey: 1,
          monthOrders: 1,
          monthSales: 1,
          monthCommissionAccrued: 1,
          lifetimeSales: 1,
          lifetimeCommission: 1,
          rules: 1,
          user: { name: '$u.name', email: '$u.email' },
          createdAt: 1,
          updatedAt: 1,
        },
      },
      { $sort: { monthSales: -1, createdAt: -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },
    ]),
    Affiliate.countDocuments(affMatch),
  ]);

  res.json({
    success: true,
    data: rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

/* --------- Affiliate detail --------- */
router.get('/affiliates/:id', ...secureAdminOnly, async (req: Request, res: Response) => {
  const aff = await Affiliate.findById(req.params.id).lean();
  if (!aff) return res.status(404).json({ success: false, message: 'Not found' });

  const user = await User.findById(aff.userId).select('name email').lean();
  const payouts = await AffiliatePayout.find({ affiliateId: aff._id }).sort({ createdAt: -1 }).lean();

  res.json({ success: true, affiliate: aff, user, payouts });
});

/* --------- Attributions (filterable) --------- */
router.get('/attributions', ...secureAdminOnly, async (req: Request, res: Response) => {
  const { affiliateId, monthKey, status, limit = 200 } = req.query as {
    affiliateId?: string;
    monthKey?: string;
    status?: string;
    limit?: any;
  };

  const q: any = {};
  if (affiliateId) q.affiliateId = oid(affiliateId);
  if (monthKey) q.monthKey = monthKey;
  if (status) q.status = status;

  const rows = await AffiliateAttribution.find(q)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json({ success: true, data: rows });
});

/* --------- Payouts list --------- */
router.get('/payouts', ...secureAdminOnly, async (req: Request, res: Response) => {
  const { status, monthKey, limit = 100 } = req.query as { status?: string; monthKey?: string; limit?: any };

  const q: any = {};
  if (status) q.status = status;
  if (monthKey) q.monthKey = monthKey;

  const rows = await AffiliatePayout.find(q).sort({ createdAt: -1 }).limit(Number(limit)).lean();
  res.json({ success: true, data: rows });
});

/* --------- Approve payout --------- */
router.post('/payouts/:id/approve', ...secureAdminOnly, async (req: Request, res: Response) => {
  const { txnId, method, note } = (req.body || {}) as { txnId?: string; method?: string; note?: string };
  const p = await AffiliatePayout.findById(req.params.id);
  if (!p) return res.status(404).json({ success: false, message: 'Not found' });
  if (p.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });
  if (!txnId) return res.status(400).json({ success: false, message: 'txnId required' });

  p.status = 'paid';
  (p as any).paidAt = new Date();
  (p as any).txnId = txnId;
  (p as any).method = method;
  (p as any).note = note;
  await p.save();

  await AffiliateAttribution.updateMany(
    { affiliateId: p.affiliateId, monthKey: p.monthKey, status: { $in: ['locked', 'approved'] } },
    { $set: { status: 'paid' } }
  );

  res.json({ success: true, payout: p });
});

/* --------- Reject payout --------- */
router.post('/payouts/:id/reject', ...secureAdminOnly, async (req: Request, res: Response) => {
  const { reason } = (req.body || {}) as { reason?: string };
  const p = await AffiliatePayout.findByIdAndUpdate(
    req.params.id,
    { $set: { status: 'rejected', reason: reason || 'Rejected by admin' } },
    { new: true }
  );
  if (!p) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, payout: p });
});

/* --------- Update rules (tiers) --------- */
router.post('/affiliates/:id/rules', ...secureAdminOnly, async (req: Request, res: Response) => {
  const { tiers } = (req.body || {}) as { tiers?: Array<{ min: number; rate: number }> };
  if (!Array.isArray(tiers) || !tiers.length) {
    return res.status(400).json({ success: false, message: 'Invalid tiers' });
  }
  const aff = await Affiliate.findByIdAndUpdate(
    req.params.id,
    { $set: { rules: { tiers } } },
    { new: true }
  ).lean();
  if (!aff) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, affiliate: aff });
});

/* --------- Manual adjustment (+/- commission) --------- */
router.post('/affiliates/:id/adjust', ...secureAdminOnly, async (req: Request, res: Response) => {
  const { amount = 0, note = 'manual_adjustment', monthKey } = (req.body || {}) as {
    amount?: number;
    note?: string;
    monthKey?: string;
  };
  const aff = await Affiliate.findById(req.params.id);
  if (!aff) return res.status(404).json({ success: false, message: 'Not found' });
  const mk = monthKey || aff.monthKey;

  await AffiliateAttribution.create({
    affiliateId: aff._id,
    orderId: null,
    userId: null,
    orderNumber: `ADJ-${Date.now()}`,
    monthKey: mk,
    // tolerate schema differences
    saleAmount: 0,
    commissionAmount: Number(amount),
    status: 'approved',
    meta: { type: 'adjustment', note },
  } as any);

  await Affiliate.updateOne(
    { _id: aff._id },
    {
      $inc: {
        monthCommissionAccrued: Number(amount),
        lifetimeCommission: Number(amount),
      },
    }
  );

  res.json({ success: true });
});

/* --------- CSV export of attributions --------- */
router.get('/attributions/export/csv', ...secureAdminOnly, async (req: Request, res: Response) => {
  const { affiliateId, monthKey } = req.query as { affiliateId?: string; monthKey?: string };
  const q: any = {};
  if (affiliateId) q.affiliateId = oid(affiliateId);
  if (monthKey) q.monthKey = monthKey;

  const rows = await AffiliateAttribution.find(q).sort({ createdAt: -1 }).lean();

  const csv = [
    'createdAt,monthKey,affiliateId,orderId,orderNumber,saleAmount,commissionAmount,status',
    ...rows.map((r: any) =>
      [
        new Date(r.createdAt).toISOString(),
        r.monthKey,
        r.affiliateId,
        r.orderId || '',
        r.orderNumber || '',
        // tolerate both schemas: saleAmount or amount
        Number(r.saleAmount ?? r.amount ?? 0),
        Number(r.commissionAmount ?? 0),
        r.status,
      ].join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attributions_${Date.now()}.csv"`);
  res.send(csv);
});

export default router;
