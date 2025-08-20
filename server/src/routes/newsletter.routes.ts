import express from 'express';
import { customAlphabet } from 'nanoid';
import validator from 'validator';
import NewsletterSubscriber from '../models/NewsletterSubscriber';
import { sendMailSafe } from '../templates/mail';
import { verifyTemplate } from '../templates/email';

const router = express.Router();
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 40);

function appBaseUrl(req: express.Request) {
  const explicit = process.env.APP_URL || process.env.BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.get('host');
  return `${proto}://${host}`;
}

/** POST /api/newsletter/subscribe */
router.post('/subscribe', async (req, res) => {
  try {
    const { email, source } = req.body || {};
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

    if (!email || !validator.isEmail(String(email))) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const normalized = String(email).toLowerCase().trim();
    let sub = await NewsletterSubscriber.findOne({ email: normalized });

    // Already verified
    if (sub && sub.verified) {
      return res.json({ success: true, message: 'Already subscribed. Thank you!' });
    }

    // New or re-subscribe flow
    const token = nanoid();
    if (!sub) {
      sub = new NewsletterSubscriber({
        email: normalized,
        token,
        ip,
        source: source || 'website',
        verified: false,
      });
    } else {
      sub.token = token;
      sub.ip = ip;
      sub.source = source || sub.source || 'website';
      sub.verified = false;
      sub.verifiedAt = null;
    }
    await sub.save();

    const verifyUrl = `${appBaseUrl(req)}/api/newsletter/verify?token=${encodeURIComponent(token)}`;
    const template = verifyTemplate(verifyUrl);

    const send = await sendMailSafe({
      to: normalized,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    if (!send.ok) {
      // We keep the record with token; user can request re-send later.
      return res.status(202).json({
        success: true,
        message: 'Subscription received, but email delivery failed. Please try again later.',
      });
    }

    return res.json({
      success: true,
      message: 'Check your inbox to confirm your subscription.',
    });
  } catch (err: any) {
    console.error('Newsletter subscribe error', err);
    return res.status(500).json({ success: false, message: 'Subscription failed. Please try again.' });
  }
});

/** GET /api/newsletter/verify?token=... */
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).send('Missing token');

    const sub = await NewsletterSubscriber.findOne({ token });
    if (!sub) return res.status(400).send('Invalid or expired token');

    sub.verified = true;
    sub.verifiedAt = new Date();
    sub.token = null;
    await sub.save();

    const redirectTo =
      process.env.NEWSLETTER_REDIRECT_URL ||
      `${process.env.FRONTEND_URL || appBaseUrl(req)}/?subscribed=1`;

    return res.redirect(302, redirectTo);
  } catch (err) {
    console.error('Newsletter verify error', err);
    return res.status(500).send('Verification failed.');
  }
});

export default router;
