import { Request, Response } from 'express';
import Affiliate from '../models/Affiliate';
import AffiliatePayout from '../models/AffiliatePayout';

/* ─────────────── USER: request payout ─────────────── */
export const requestAffiliatePayoutSimple = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      monthKey,
      accountHolder,
      bankAccount,
      ifsc,
      bankName,
      city,
      upiId,
      aadharLast4,
      pan
    } = req.body;

    const affiliate = await Affiliate.findOne({ userId: (req.user as any).id });
    if (!affiliate) {
      res.status(404).json({ error: 'Affiliate not found' });
      return;
    }

    const amount = affiliate.monthCommissionAccrued || 0;
    if (amount <= 0) {
      res.status(400).json({ error: 'No commission to withdraw' });
      return;
    }

    const existing = await AffiliatePayout.findOne({
      affiliateId: affiliate._id,
      monthKey
    });
    if (existing) {
      res.status(400).json({ error: 'Payout already requested for this month' });
      return;
    }

    const payout = await AffiliatePayout.create({
      affiliateId: affiliate._id,
      userId: (req.user as any).id,
      monthKey,
      amount,
      accountHolder,
      bankAccount,
      ifsc,
      bankName,
      city,
      upiId,
      aadharLast4,
      pan,
      status: 'requested'
    });

    res.json({ success: true, payout });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

/* ─────────────── ADMIN: view all payouts ─────────────── */
export const getAffiliatePayoutsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const role = (req.user as any).role;
    if (!['admin', 'super_admin'].includes(role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const payouts = await AffiliatePayout.find({})
      .populate('affiliateId', 'code')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: payouts });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
