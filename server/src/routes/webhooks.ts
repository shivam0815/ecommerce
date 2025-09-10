// src/routes/webhooks.ts
import crypto from 'crypto';
import express, { Router, Request, Response } from 'express';
import ReturnRequest from '../models/ReturnRequest';
import Order, { IOrder } from '../models/Order';
import email from '../config/emailService'; // ⬅️ NEW

const router = Router();
const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

/** Constant-time signature verify against raw body buffer */
function verifySignature(sig: string | undefined, bodyBuf: Buffer): boolean {
  if (!sig || !secret) return false;
  const digest = crypto.createHmac('sha256', secret).update(bodyBuf).digest('hex');
  if (digest.length !== (sig?.length ?? 0)) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig!));
}

const tsFrom = (unix?: number) => (unix ? new Date(unix * 1000) : new Date());

router.post(
  '/razorpay',
  // IMPORTANT: raw body for signature verification
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.header('x-razorpay-signature');
    const bodyBuf = req.body as Buffer;

    if (!verifySignature(signature, bodyBuf)) {
      return res.status(400).send('Invalid signature');
    }

    let evt: any;
    try {
      evt = JSON.parse(bodyBuf.toString('utf8'));
    } catch {
      return res.status(400).send('Invalid payload');
    }

    try {
      switch (evt.event) {
        /* ───────────────────── refunds (already present) ───────────────────── */
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

        /* ───────────────────── capture (already present) ───────────────────── */
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

        /* ───────────────────── NEW: payment link lifecycle ─────────────────── */
        case 'payment_link.paid':
        case 'payment_link.partially_paid':
        case 'payment_link.expired':
        case 'payment_link.cancelled': {
          const pl = evt?.payload?.payment_link?.entity;
          if (!pl) break;

          const linkId: string = pl.id;
          const statusMap: Record<string, 'pending' | 'paid' | 'partial' | 'expired' | 'cancelled'> = {
            paid: 'paid',
            partially_paid: 'partial',
            expired: 'expired',
            cancelled: 'cancelled',
          };
          const newStatus = statusMap[pl.status] ?? 'pending';

          // Find the order that carries this payment link
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

          // Notify customer about the outcome (receipt / partial / expired / cancelled)
          await email.sendShippingPaymentReceipt(order, {
            status: newStatus,
            amount: (pl.amount_paid || 0) / 100,
            shortUrl: pl.short_url,
          });

          break;
        }

        default:
          // Ignore other events
          break;
      }

      // Always ACK quickly so Razorpay stops retries
      return res.json({ status: 'ok' });
    } catch (e) {
      // Log internally if you want, but still ACK to avoid repeated retries
      console.error('Webhook handler error:', e);
      return res.json({ status: 'ok' });
    }
  }
);

export default router;
