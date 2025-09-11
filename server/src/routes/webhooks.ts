// src/routes/webhooks.ts
import { Router, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';  // ✅ Node crypto (no DOM clash)
import ReturnRequest from '../models/ReturnRequest';
import Order, { IOrder } from '../models/Order';
import email from '../config/emailService';

const router = Router();
const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

/** Constant-time signature verify against raw body buffer */
function verifySignature(sig: string | undefined, bodyBuf: Buffer): boolean {
  if (!sig || !secret) return false;
  const digest = createHmac('sha256', secret).update(bodyBuf).digest('hex');

  // timingSafeEqual requires equal length buffers
  if (sig.length !== digest.length) return false;

  return timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
}

const tsFrom = (unix?: number) => (unix ? new Date(unix * 1000) : new Date());

router.post('/razorpay', async (req: Request, res: Response) => {
  // ⚠️ NOTE: req.body is a Buffer because server.ts mounted raw() for this path.
  try {
    const signature = req.header('X-Razorpay-Signature') || req.header('x-razorpay-signature') || '';
    const bodyBuf = (req.body ?? Buffer.alloc(0)) as Buffer;

    // ✅ Verify first
    if (!verifySignature(signature, bodyBuf)) {
      console.error('❌ Invalid Razorpay webhook signature');
      // Still ACK 200 to avoid disable/retry storms
      return res.status(200).json({ status: 'ok' });
    }

    // ✅ Parse after verifying
    let evt: any;
    try {
      evt = JSON.parse(bodyBuf.toString('utf8'));
    } catch {
      console.error('❌ Invalid JSON payload');
      return res.status(200).json({ status: 'ok' }); // ACK anyway
    }

    // ✅ ACK FAST (<5s) — do the heavy work asynchronously
    res.status(200).json({ status: 'ok' });

    // ---------- Async processing (non-blocking) ----------
    setImmediate(async () => {
      try {
        // TODO (recommended): Idempotency — persist evt.id and bail if already processed.

        switch (evt.event) {
          /* ───────────────────── refunds ───────────────────── */
          case 'refund.created':
          case 'refund.processed':
          case 'refund.failed': {
            const r = evt?.payload?.refund?.entity;
            if (!r) break;

            const refundId: string = r.id;
            const amount = (r.amount ?? 0) / 100;
            const status: 'created' | 'processed' | 'failed' = r.status;
            const orderId: string | undefined = r?.notes?.orderId;

            const rr = await ReturnRequest.findOne({ 'refund.reference': refundId });
            if (rr) {
              const already = rr.history?.some(
                (h: any) => h.note === refundId && h.action === `refund_${status}`
              );
              if (!already) {
                rr.history.push({ at: tsFrom(evt.created_at), action: `refund_${status}`, note: refundId });
                if (status === 'processed') rr.status = 'refund_completed';
                await rr.save();
              }
            }

            if (orderId) {
              await Order.findByIdAndUpdate(orderId, {
                $set: {
                  refundId: refundId,
                  refundAmount: amount,
                  refundStatus: status,
                  refundedAt: tsFrom(evt.created_at),
                },
              });
            }
            break;
          }

          /* ───────────────────── payment captured ───────────────────── */
          case 'payment.captured': {
            const p = evt?.payload?.payment?.entity;
            if (!p) break;
            const paymentId: string = p.id;
            const orderId: string | undefined = p?.notes?.orderId;

            if (orderId) {
              await Order.findByIdAndUpdate(orderId, {
                $set: {
                  paymentId,
                  paymentStatus: 'paid',
                  paidAt: p.captured ? tsFrom(p.created_at) : new Date(),
                },
              });
            }
            break;
          }

          /* ─────────────── payment link lifecycle (shipping charges) ─────────────── */
          case 'payment_link.paid':
          case 'payment_link.partially_paid':
          case 'payment_link.expired':
          case 'payment_link.cancelled': {
            const pl = evt?.payload?.payment_link?.entity;
            if (!pl) break;

            const linkId: string = pl.id;
            const map: Record<string, 'pending' | 'paid' | 'partial' | 'expired' | 'cancelled'> = {
              paid: 'paid',
              partially_paid: 'partial',
              expired: 'expired',
              cancelled: 'cancelled',
            };
            const newStatus = map[pl.status] ?? 'pending';

            const order = (await Order.findOne({ 'shippingPayment.linkId': linkId })) as IOrder | null;
            if (!order) break;

            order.shippingPayment = {
              ...(order.shippingPayment || {}),
              linkId,
              shortUrl: pl.short_url,
              status: newStatus,
              currency: pl.currency || order.shippingPayment?.currency || 'INR',
              amount: (pl.amount || 0) / 100,
              amountPaid: (pl.amount_paid || 0) / 100,
              paymentIds: Array.isArray(pl.payments) ? pl.payments.map((p: any) => p.id) : (order.shippingPayment?.paymentIds || []),
              paidAt: ['paid', 'partially_paid'].includes(pl.status) ? tsFrom(evt.created_at) : order.shippingPayment?.paidAt,
            };

            await order.save();

            // send email non-blocking; ignore failures
            try {
              await email.sendShippingPaymentReceipt(order, {
                status: newStatus,
                amount: (pl.amount_paid || 0) / 100,
                shortUrl: pl.short_url,
              });
            } catch (e) {
              console.error('Email send failed (shipping payment receipt):', e);
            }
            break;
          }

          default:
            // ignore others
            break;
        }
      } catch (e) {
        console.error('Webhook async error:', e);
      }
    });
  } catch (e) {
    console.error('Webhook entry error:', e);
    // Even on unexpected errors, we already ACKed above.
    if (!res.headersSent) return res.status(200).json({ status: 'ok' });
  }
});

export default router;
