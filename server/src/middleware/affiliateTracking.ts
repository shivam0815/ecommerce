// src/middleware/affiliateTracking.ts
import { Request, Response, NextFunction } from 'express';
import Affiliate from '../models/Affiliate';
import { randomUUID } from 'crypto';

const COOKIE_CODE = 'aff_code';
const COOKIE_CLICK = 'aff_click';

export async function captureAffiliate(req: Request, res: Response, next: NextFunction) {
  const code = (req.query.aff as string | undefined)?.trim();
  if (code) {
    const aff = await Affiliate.findOne({ code, active: true }).lean();
    if (aff) {
      res.cookie(COOKIE_CODE, code, { httpOnly: false, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
      res.cookie(COOKIE_CLICK, randomUUID(), { httpOnly: false, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
    }
  }
  next();
}
