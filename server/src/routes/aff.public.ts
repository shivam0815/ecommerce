// src/routes/aff.public.ts
import { Router } from 'express';
import Affiliate from '../models/Affiliate';

const router = Router();

router.get('/ping', (_req, res) => res.json({ ok: true }));  // smoke test

router.post('/visit', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'code required' });

    const aff = await Affiliate.findOne({ code }).lean();
    if (!aff) return res.status(404).json({ success: false, message: 'invalid code' });

    return res.json({ success: true, message: 'affiliate code recorded' });
  } catch {
    return res.status(500).json({ success: false, message: 'error' });
  }
});

export default router;
