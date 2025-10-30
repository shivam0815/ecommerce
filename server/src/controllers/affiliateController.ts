// src/controllers/affiliateController.ts
import { Request, Response } from 'express';
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import Affiliate from '../models/Affiliate';
import AffiliatePayout from '../models/AffiliatePayout';

/* ───────── Config ───────── */
const MIN_PAYOUT = Number(process.env.AFF_MIN_PAYOUT ?? 500); // ₹
const HOLD_DAYS  = Number(process.env.AFF_HOLD_DAYS  ?? 7);   // informative only in meta
// If you pay only the previous, closed month, set true. If you pay the month sent by client, set false.
const PAY_PREV_CLOSED_ONLY = false;

/* ───────── Helpers ───────── */
const yyyymm = (d: Date) => dayjs(d).format('YYYY-MM');

const prevClosedKey = () => yyyymm(dayjs().subtract(1, 'month').toDate());

const sanitizeLast4 = (v: unknown) =>
  String(v ?? '').replace(/\D/g, '').slice(-4);

const bankCodeFromIFSC = (ifsc?: string) =>
  (ifsc ?? '').toUpperCase().trim().slice(0, 4); // e.g., HDFC, ICIC, CNRB, SBIN

const looksLikeUPI = (v?: string) => !v || /^[a-z0-9._-]+@[a-z]{3,}$/i.test(v);

/* Optional tiny map to warn on obvious bank-IFSC mismatches.
   Do not hard-fail, because branches exist. */
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
      aadharLast4,
      pan,
    } = req.body as {
      monthKey?: string;
      accountHolder?: string;
      bankAccount?: string;
      ifsc?: string;
      bankName?: string;
      city?: string;
      upiId?: string;
      aadharLast4?: string | number;
      pan?: string;
    };

    // Month scoping
    const nowKey = yyyymm(new Date());
    if (!monthKey) monthKey = PAY_PREV_CLOSED_ONLY ? prevClosedKey() : nowKey;
    if (PAY_PREV_CLOSED_ONLY && monthKey === nowKey) {
      // Enforce previous month only
      monthKey = prevClosedKey();
    }

    // Basic KYC hygiene (do not block payout on soft issues)
    const last4 = sanitizeLast4(aadharLast4);
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
    if (last4.length !== 4) {
      res.status(400).json({ error: 'invalid_aadhar_last4' });
      return;
    }

    const affiliate = await Affiliate.findOne({ userId });
    if (!affiliate) {
      res.status(404).json({ error: 'affiliate_not_found' });
      return;
    }
    // below: const affiliate = await Affiliate.findOne({ userId });
const minPayout =
  Number((affiliate as any)?.rules?.minPayout) || MIN_PAYOUT;


    // Compute month-accrued from the *same* source your UI uses.
    // Your current schema stores the active month’s stats on the Affiliate doc.
    // If you keep only the current month on the doc, we can only pay that month.
    // Guard: only use monthCommissionAccrued when the doc monthKey matches the requested monthKey.
    const accrued =
      (affiliate as any).monthKey === monthKey
        ? Number((affiliate as any).monthCommissionAccrued ?? 0)
        : 0;

    // Subtract already requested/paid payouts for the same month (idempotency)
    const prior = await AffiliatePayout.aggregate([
      { $match: { affiliateId: affiliate._id, monthKey } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const priorAmount = prior[0]?.amount ?? 0;

    const eligible = Math.max(0, accrued - priorAmount);

    if (eligible < minPayout) {
  res.status(400).json({
    error: 'nothing_to_pay',
    meta: {
      monthKey,
      accrued,
      priorAmount,
      eligible,
      minPayout,          // ← use dynamic value
      holdDays: HOLD_DAYS,
      notes: [
        PAY_PREV_CLOSED_ONLY ? 'pay_prev_closed_only=true' : 'pay_prev_closed_only=false',
        bankMismatch ? 'ifsc_bank_name_mismatch_hint' : 'ok',
      ],
    },
  });
  return;
}


    // Create payout atomically and keep a lightweight idempotency on (affiliateId, monthKey).
    const session = await mongoose.startSession();
    let payoutDoc: any;
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

      payoutDoc = await AffiliatePayout.create(
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
            aadharLast4: last4,
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
      payoutDoc = Array.isArray(payoutDoc) ? payoutDoc[0] : payoutDoc;
    });
    session.endSession();

    res.json({
      success: true,
      payout: payoutDoc,
      meta: {
        monthKey,
        eligible,
        minPayout: MIN_PAYOUT,
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
