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

export async function tryAttributeOrder(order: any, ctx: { affCode?: string; affClick?: string }) {
  if (!order) return;
  const status = (order.paymentStatus || order.orderStatus || '').toLowerCase();
  if (!['paid', 'confirmed'].includes(status)) return;
  if (order.channel && order.channel !== 'b2b') return;

  const code = ctx.affCode || order.meta?.affCode || order.cookies?.aff_code;
  if (!code) return;

  const aff = await Affiliate.findOne({ code, active: true });
  if (!aff) return;

  const key = monthKey();
  if (aff.monthKey !== key) {
    aff.monthKey = key; aff.monthSales = 0; aff.monthOrders = 0; aff.monthCommissionAccrued = 0;
  }

  const subtotal = Number(order.subtotal || 0); // ensure GST, shipping, fees excluded upstream
  const eligible = Math.max(0, subtotal);
  const pct = pickPercent(aff.rules, aff.monthSales);
  const commission = +(eligible * (pct / 100)).toFixed(2);

  await AffiliateAttribution.create({
    affiliateId: aff._id,
    clickId: ctx.affClick || order.meta?.affClick || null,
    orderId: order._id,
    orderNumber: order.orderNumber,
    amount: eligible,
    commissionPercent: pct,
    commissionAmount: commission,
    status: 'pending',
    monthKey: key,
  });

  aff.monthSales += eligible;
  aff.monthOrders += 1;
  aff.monthCommissionAccrued += commission;
  aff.lifetimeSales += eligible;
  aff.lifetimeCommission += commission;
  await aff.save();
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
