import crypto from 'crypto';
import express, { Router, Request, Response } from 'express';
import ReturnRequest from '../models/ReturnRequest';
import Order from '../models/Order';

const router = Router();
const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

/** Constant-time signature verify against raw body buffer */
function verifySignature(sig: string | undefined, bodyBuf: Buffer): boolean {
  if (!sig || !secret) return false;
  const digest = crypto.createHmac('sha256', secret).update(bodyBuf).digest('hex');
  // timingSafeEqual requires equal length
  if (digest.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig));
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
        // You’ll see created → processed/failed. Handle all three idempotently.
        case 'refund.created':
        case 'refund.processed':
        case 'refund.failed': {
          const r = evt?.payload?.refund?.entity;
          if (!r) break;

          const refundId: string = r.id;
          const amount = (r.amount ?? 0) / 100;
          const status: 'created' | 'processed' | 'failed' = r.status;
          const orderId: string | undefined = r?.notes?.orderId;

          // 1) Update ReturnRequest (your existing model), guard duplicates
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

          // 2) Also update Order if you stored notes.orderId when creating the refund
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

        // Optional: mark order paid when Razorpay confirms capture
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

        default:
          // Ignore other events
          break;
      }

      // Always ACK quickly so Razorpay stops retries
      return res.json({ status: 'ok' });
    } catch (e) {
      // Log internally if you want, but still ACK to avoid repeated retries
      return res.json({ status: 'ok' });
    }
  }
);

export default router;
