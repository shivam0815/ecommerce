// routes/webhooks.ts
import crypto from 'crypto';
import { Router } from 'express';
import ReturnRequest from '../models/ReturnRequest';

const router = Router();
const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;

function verify(sig: string, body: string) {
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(body);
  return shasum.digest('hex') === sig;
}

router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const bodyStr = req.body.toString();

  if (!verify(signature, bodyStr)) {
    return res.status(400).send('Invalid signature');
  }

  const evt = JSON.parse(bodyStr);

  try {
    if (evt.event === 'refund.processed') {
      const refundId = evt.payload.refund.entity.id;
      const rr = await ReturnRequest.findOne({ 'refund.reference': refundId });
      if (rr && rr.status !== 'refund_completed') {
        rr.status = 'refund_completed';
        rr.history.push({ at: new Date(), action: 'refund_completed', note: refundId });
        await rr.save();
      }
    }

    if (evt.event === 'refund.failed') {
      const refundId = evt.payload.refund.entity.id;
      const rr = await ReturnRequest.findOne({ 'refund.reference': refundId });
      if (rr) {
        rr.history.push({ at: new Date(), action: 'refund_failed', note: refundId });
        await rr.save();
      }
    }

    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error' });
  }
});

export default router;
