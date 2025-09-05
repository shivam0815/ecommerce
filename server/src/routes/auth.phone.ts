import { Router } from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';

const router = Router();

const API_KEY = process.env.TWOFACTOR_API_KEY || '';
const OTP_TTL_SEC = Number(process.env.OTP_TTL_SEC || 300);
const DEV_FAKE_OTP = (process.env.OTP_DEV_FAKE || '').replace(/['"]/g, ''); // e.g. 123456
const DEFAULT_CC = process.env.OTP_DEFAULT_COUNTRY || '+91';

// Basic limiter to avoid abuse
const sendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8, // 8 sends per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Normalize phone → E.164-like (+91xxxxxxxxxx)
const normalizePhone = (raw: string) => {
  let p = (raw || '').trim().replace(/\s+/g, '');
  if (!p) return '';
  if (!p.startsWith('+')) p = DEFAULT_CC + p;
  return p;
};

// In-memory store for DEV mode OTPs
// In production, you don't need this if using 2Factor; but we keep it as a fallback.
const devOtpStore = new Map<string, { code: string; exp: number }>();

/**
 * POST /api/auth/phone/send-otp
 * PUBLIC – NO AUTH
 * body: { phone: string }
 */
router.post('/auth/phone/send-otp', sendLimiter, async (req, res) => {
  try {
    const rawPhone = String(req.body?.phone || '');
    const phone = normalizePhone(rawPhone);
    if (!/^\+\d{9,15}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone' });
    }

    // If no 2Factor API key, use DEV fallback
    if (!API_KEY) {
      const code = DEV_FAKE_OTP || String(Math.floor(100000 + Math.random() * 900000));
      const exp = Date.now() + OTP_TTL_SEC * 1000;
      devOtpStore.set(phone, { code, exp });
      console.log(`[DEV OTP] ${phone} -> ${code} (valid ${OTP_TTL_SEC}s)`);
      return res.json({ success: true, provider: 'dev', ttl: OTP_TTL_SEC });
    }

    // Real 2Factor: AUTOGEN
    const url = `https://2factor.in/API/V1/${API_KEY}/SMS/${encodeURIComponent(phone)}/AUTOGEN`;
    const resp = await axios.get(url, { timeout: 10000 });
    if (resp.data?.Status !== 'Success') {
      return res.status(502).json({ success: false, message: 'OTP provider error', details: resp.data });
    }

    return res.json({ success: true, provider: '2factor', details: resp.data });
  } catch (err: any) {
    console.error('send-otp error:', err?.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

/**
 * POST /api/auth/phone/verify
 * PUBLIC – NO AUTH
 * body: { phone: string, otp: string }
 */
router.post('/auth/phone/verify', async (req, res) => {
  try {
    const rawPhone = String(req.body?.phone || '');
    const otp = String(req.body?.otp || '');
    const phone = normalizePhone(rawPhone);

    if (!/^\+\d{9,15}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone' });
    }
    if (!/^\d{4,8}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP format' });
    }

    // DEV fallback (no API key)
    if (!API_KEY) {
      const record = devOtpStore.get(phone);
      if (!record) return res.status(400).json({ success: false, message: 'OTP not requested' });
      if (Date.now() > record.exp) {
        devOtpStore.delete(phone);
        return res.status(400).json({ success: false, message: 'OTP expired' });
      }
      if (record.code !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
      devOtpStore.delete(phone);

      // TODO: upsert user and issue JWT or session cookie
      return res.json({ success: true, verified: true, provider: 'dev', user: { phone } });
    }

    // Real 2Factor VERIFY
    const url = `https://2factor.in/API/V1/${API_KEY}/SMS/VERIFY3/${encodeURIComponent(phone)}/${encodeURIComponent(otp)}`;
    const resp = await axios.get(url, { timeout: 10000 });

    if (resp.data?.Status !== 'Success') {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP', details: resp.data });
    }

    // TODO: upsert user and issue JWT or session cookie
    return res.json({ success: true, verified: true, provider: '2factor', user: { phone } });
  } catch (err: any) {
    console.error('verify error:', err?.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

export default router;
