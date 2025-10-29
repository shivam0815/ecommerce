// src/services/affiliate.service.ts
import dayjs from 'dayjs';
import Affiliate from '../models/Affiliate';
import AffiliateAttribution from '../models/AffiliateAttribution';

const monthKey = () => dayjs().format('YYYY-MM');
const pickPercent = (rules: { minMonthlySales?: number | null; percent?: number | null }[] = [], current: number) => {
  let pct = 0;
  for (const r of rules) {
    const min = r?.minMonthlySales ?? 0;
    const p = r?.percent ?? 0;
    if (current >= min) pct = p;
  }
  return pct;
};

// src/services/affiliate.service.ts
export async function tryAttributeOrder(order: any, ctx: { affCode?: string; affClick?: string }) {
  if (!order) return;

  const pay = String(order.paymentStatus || '').toLowerCase();
  const ord = String(order.orderStatus || '').toLowerCase();
  const isPaidOrConfirmed = ['paid', 'cod_paid'].includes(pay) || ['confirmed','processing','shipped','delivered'].includes(ord);
  const isPendingCreateOk  = ['awaiting_payment','cod_pending','pending'].includes(pay) || ord === 'pending';
  if (!(isPaidOrConfirmed || isPendingCreateOk)) return;

  // B2B-only if channel explicitly set to non-b2b
  if (order.channel && order.channel !== 'b2b') return;

  const code =
    ctx.affCode ||
    order.affiliateCode ||             // ← read from order
    order.meta?.affCode ||
    order.cookies?.aff_code;
  if (!code) return;

  const aff = await Affiliate.findOne({ code: code.toUpperCase(), active: true });
  if (!aff) return;

  const key = monthKey();
  if (aff.monthKey !== key) {
    aff.monthKey = key; aff.monthSales = 0; aff.monthOrders = 0; aff.monthCommissionAccrued = 0;
  }

  const subtotal = Number(order.subtotal || 0);
  const eligible = Math.max(0, subtotal);

  // normalize rules: support {tiers:[{min,rate}]} or array of {minMonthlySales,percent}
  const tiers = Array.isArray((aff as any).rules?.tiers)
    ? (aff as any).rules.tiers
    : Array.isArray((aff as any).rules)
      ? (aff as any).rules
      : [];
  const norm = tiers.map((t: any) => ({
    minMonthlySales: Number(t.min ?? t.minMonthlySales ?? 0),
    percent: Number(
      t.percent != null
        ? t.percent
        : t.rate != null
          ? (Number(t.rate) <= 1 ? Number(t.rate) * 100 : Number(t.rate))
          : 0
    ),
  }));
  const pct = pickPercent(norm, aff.monthSales);
  const commission = +(eligible * (pct / 100)).toFixed(2);

  await AffiliateAttribution.create({
    affiliateId: aff._id,
    clickId: ctx.affClick || order.meta?.affClick || null,
    orderId: order._id,
    orderNumber: order.orderNumber,
    amount: eligible,
    commissionPercent: pct,
    commissionAmount: commission,
    status: isPaidOrConfirmed ? 'approved' : 'pending',
    monthKey: key,
  });

  aff.monthSales += eligible;
  aff.monthOrders += 1;
  aff.monthCommissionAccrued += commission;
  aff.lifetimeSales += eligible;
  aff.lifetimeCommission += commission;
  await aff.save();

  // mark on order for visibility
  if (order.affiliateAttributionStatus !== 'recorded') {
    order.affiliateAttributionStatus = 'recorded';
    try { await order.save?.(); } catch {}
  }
}


export async function reverseAttributionForOrder(orderId: string, reason: string, partialAmount?: number) {
  const row = await AffiliateAttribution.findOne({ orderId, status: { $ne: 'reversed' } });
  if (!row) return;

  if (partialAmount && partialAmount > 0) {
    const rate = row.commissionPercent / 100;
    const rev = +(partialAmount * rate).toFixed(2);
    await AffiliateAttribution.create({
      affiliateId: row.affiliateId,
      clickId: row.clickId,
      orderId: row.orderId, // allow multiple rows per order
      orderNumber: row.orderNumber,
      amount: -partialAmount,
      commissionPercent: row.commissionPercent,
      commissionAmount: -rev,
      status: 'reversed',
      reason,
      monthKey: row.monthKey,
    });
  } else {
    row.status = 'reversed';
    row.reason = reason;
    await row.save();
  }
}
