// src/controllers/affiliateController.ts
import { Request, Response } from 'express';
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import Affiliate from '../models/Affiliate';
import AffiliatePayout from '../models/AffiliatePayout';

/* ───────── Config ───────── */
const HOLD_DAYS = Number(process.env.AFF_HOLD_DAYS ?? 7);
const PAY_PREV_CLOSED_ONLY = false;

/* ───────── Helpers ───────── */
const yyyymm = (d: Date) => dayjs(d).format('YYYY-MM');
const prevClosedKey = () => yyyymm(dayjs().subtract(1, 'month').toDate());
const bankCodeFromIFSC = (ifsc?: string) => (ifsc ?? '').toUpperCase().trim().slice(0, 4);
const looksLikeUPI = (v?: string) => !v || /^[a-z0-9._-]+@[a-z]{3,}$/i.test(v);

// hint only
const BANK_IFSC_HINT: Record<string, string[]> = {
  HDFC: ['HDFC'],
  ICIC: ['ICICI', 'ICIC'],
  CNRB: ['CANARA', 'CNRB'],
  SBIN: ['SBI', 'STATE BANK', 'SBIN'],
};

/* ─────────────── USER: request payout ─────────────── */
export const requestAffiliatePayoutSimple = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const userId = (req.user as any).id as string;

    let {
      monthKey,
      accountHolder,
      bankAccount,
      ifsc,
      bankName,
      city,
      upiId,
      aadharLast4, // contains full 12-digit Aadhaar now
      pan,
    } = req.body as {
      monthKey?: string;
      accountHolder?: string;
      bankAccount?: string;
      ifsc?: string;
      bankName?: string;
      city?: string;
      upiId?: string;
      aadharLast4?: string | number; // holds 12-digit Aadhaar
      pan?: string;
    };

    // month scope
    const nowKey = yyyymm(new Date());
    if (!monthKey) monthKey = PAY_PREV_CLOSED_ONLY ? prevClosedKey() : nowKey;
    if (PAY_PREV_CLOSED_ONLY && monthKey === nowKey) monthKey = prevClosedKey();

    // KYC checks
    const aadhaar = String(aadharLast4 ?? '').replace(/\D/g, '');
    const ifscCode = bankCodeFromIFSC(ifsc);
    const bankMismatch =
      !!bankName &&
      !!ifscCode &&
      BANK_IFSC_HINT[ifscCode] &&
      !BANK_IFSC_HINT[ifscCode].some((hint) => bankName.toUpperCase().includes(hint));

    if (!accountHolder || !bankAccount || !ifsc || !bankName || !city) {
      res.status(400).json({ error: 'invalid_kyc', meta: { reason: 'missing_bank_fields' } });
      return;
    }
    if (!looksLikeUPI(upiId)) {
      res.status(400).json({ error: 'invalid_upi_format' });
      return;
    }
    if (aadhaar.length !== 12) {
      res.status(400).json({
        error: 'invalid_aadhar_length',
        meta: { reason: 'Aadhaar must be 12 digits' },
      });
      return;
    }

    const affiliate = await Affiliate.findOne({ userId });
    if (!affiliate) {
      res.status(404).json({ error: 'affiliate_not_found' });
      return;
    }

    // hard block: only one payout request per affiliate per month
    const dup = await AffiliatePayout.findOne({ affiliateId: affiliate._id, monthKey });
    if (dup) {
      res.status(400).json({ error: 'already_requested_this_month' });
      return;
    }

    // accrued for requested month only (from same source as UI)
    const accrued =
      (affiliate as any).monthKey === monthKey
        ? Number((affiliate as any).monthCommissionAccrued ?? 0)
        : 0;

    // subtract any prior payouts (defensive; dup above should cover)
    const prior = await AffiliatePayout.aggregate([
      { $match: { affiliateId: affiliate._id, monthKey } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const priorAmount = prior[0]?.amount ?? 0;

    const eligible = Math.max(0, accrued - priorAmount);

    // no minimum threshold; require positive eligible
    if (eligible <= 0) {
      res.status(400).json({
        error: 'nothing_to_pay',
        meta: { monthKey, accrued, priorAmount, eligible, minPayout: 0, holdDays: HOLD_DAYS },
      });
      return;
    }

    // atomic create with unique (affiliateId, monthKey)
    const session = await mongoose.startSession();
    let payoutDoc: any;
    try {
      await session.withTransaction(async () => {
        const already = await AffiliatePayout.findOne(
          { affiliateId: affiliate._id, monthKey },
          null,
          { session },
        );
        if (already) {
          payoutDoc = already;
          return;
        }

        const created = await AffiliatePayout.create(
          [
            {
              affiliateId: affiliate._id,
              userId,
              monthKey,
              amount: eligible,
              accountHolder,
              bankAccount,
              ifsc,
              bankName,
              city,
              upiId,
              aadharLast4: aadhaar, // store full 12-digit Aadhaar in existing field
              pan,
              status: 'requested',
              meta: {
                accrued,
                priorAmount,
                createdFrom: 'requestAffiliatePayoutSimple',
                bankHintMismatch: bankMismatch,
              },
            },
          ],
          { session },
        );
        payoutDoc = Array.isArray(created) ? created[0] : created;
      });
    } finally {
      session.endSession();
    }

    res.json({
      success: true,
      payout: payoutDoc,
      meta: {
        monthKey,
        eligible,
        minPayout: 0,
        holdDays: HOLD_DAYS,
        bankHintMismatch: bankMismatch,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: err?.message });
  }
};

/* ─────────────── ADMIN: view all payouts ─────────────── */
export const getAffiliatePayoutsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const role = (req.user as any).role;
    if (!['admin', 'super_admin'].includes(role)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const payouts = await AffiliatePayout.find({})
      .populate('affiliateId', 'code')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: payouts });
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: err?.message });
  }
};
