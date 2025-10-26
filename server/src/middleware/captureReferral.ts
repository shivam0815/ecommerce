import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import ReferralClick from '../models/ReferralClick';

const FT = 'ref_ft'; // 90d
const LT = 'ref_lt'; // 7d

export async function captureReferral(req: Request, res: Response, next: NextFunction) {
  const code = String(req.query.ref || '').trim();
  if (!code) return next();

  const refUser = await User.findOne({ referralCode: code }).select('_id').lean();
  if (!refUser) return next();

  ReferralClick.create({ code, refUserId: refUser._id, ip: req.ip, ua: req.get('user-agent'), ts: new Date() }).catch(() => {});
  if (!req.cookies?.[FT]) res.cookie(FT, code, { httpOnly: true, sameSite: 'lax', maxAge: 90*24*3600*1000, path: '/' });
  res.cookie(LT, code, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*3600*1000, path: '/' });

  (req as any)._refCode = code;
  (req as any)._refUserId = refUser._id;
  next();
}
