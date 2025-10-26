import ReferralCommission from '../models/ReferralCommission';

export async function captureCommission(order: any) {
  if (!order?.refSource?.refUserId) return;
  if (order.userId && String(order.userId) === String(order.refSource.refUserId)) return; // block self
  if (order.paymentStatus !== 'paid') return;

  const rate = 0.02; // adjust
  const base = Math.max(0, Number(order.subtotal) || 0); // exclude GST/shipping/discounts if needed
  const amount = Math.round(base * rate);

  await ReferralCommission.updateOne(
    { orderId: order._id },
    {
      $setOnInsert: {
        orderId: order._id,
        refUserId: order.refSource.refUserId,
        buyerUserId: order.userId || null,
        amount,
        status: 'pending',
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}
