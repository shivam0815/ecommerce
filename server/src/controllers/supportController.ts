import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import SupportTicket from '../models/SupportTicket';
import SupportConfig from '../models/SupportConfig';
import SupportFaq from '../models/SupportFaq';

/** If your auth middleware sets req.user */
type AuthedRequest = Request & { user?: { _id?: Types.ObjectId; id?: string; email?: string } };

/* Helpers to accept JSON strings, single strings, or arrays */
const toArray = (val: any): any[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      // plain string or comma separated
      if (val.includes(',')) return val.split(',').map(s => s.trim()).filter(Boolean);
      return [val];
    }
  }
  return [];
};

const normalizeAtt = (x: any) => {
  if (!x) return null;
  if (typeof x === 'string') {
    const base = x.split('?')[0];
    const name = base.split('/').pop();
    return { url: x, name };
  }
  return {
    url: x.url,
    name: x.name,
    size: x.size ? Number(x.size) : undefined,
    mime: x.mime || x.type || undefined,
  };
};

/**
 * POST /api/support/tickets
 * Public – creates a support ticket. Accepts:
 *  - multer files under field "attachments"
 *  - pre-uploaded S3 URLs under "attachmentsUrls" or "attachments" (string/JSON/array)
 */
export const createSupportTicket = async (req: AuthedRequest, res: Response) => {
  try {
    // 1) Files via multer
    const files = (req.files as Express.Multer.File[]) ?? [];
    const fileAtts = (files || [])
      .map((f) => ({
        url: (f as any).path || (f as any).location || (f as any).url || '',
        name: f.originalname,
        size: f.size,
        mime: f.mimetype,
      }))
      .filter(a => a.url);

    // 2) URLs in body (S3 pre-upload flow)
    const bodyRaw = [
      ...toArray((req.body as any).attachments),      // can be [{url,...}] or single URL string
      ...toArray((req.body as any).attachmentsUrls),  // preferred payload
    ];
    const bodyAtts = bodyRaw.map(normalizeAtt).filter((a) => a && a.url);

    const attachments = [...fileAtts, ...bodyAtts];

    // Defensive trim on text fields
    const subject  = String(req.body.subject ?? '').trim();
    const message  = String(req.body.message ?? '').trim();
    const emailRaw = String(req.body.email ?? '').trim();
    const phone    = req.body.phone ? String(req.body.phone).trim() : undefined;
    const orderId  = req.body.orderId ? String(req.body.orderId).trim() : undefined;
    const category = req.body.category ? String(req.body.category).trim() : undefined;
    const priority = (req.body.priority as 'low'|'normal'|'high'|undefined) ?? 'normal';

    // Email fallback to authed user (optionalAuthenticate)
    const finalEmail = emailRaw || req.user?.email || '';
    if (!subject || subject.length < 3) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: [{ msg: 'Subject is required (min 3 chars)' }] });
    }
    if (!message || message.length < 5) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: [{ msg: 'Message is required (min 5 chars)' }] });
    }
    if (!finalEmail || !/\S+@\S+\.\S+/.test(finalEmail)) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: [{ msg: 'Valid email is required' }] });
    }

    const doc = await SupportTicket.create({
      subject,
      category,
      message,
      email: finalEmail,
      phone,
      orderId,
      priority,
      channel: 'web',
      userId: (req.user?._id as any) || (req.user?.id as any),
      attachments,
    });

    return res.status(201).json({
      success: true,
      ticket: { _id: doc._id, status: doc.status },
    });
  } catch (err: any) {
    console.error('support/tickets create error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create ticket' });
  }
};

/* unchanged public handlers */
export const getPublicSupportConfig = async (_req: Request, res: Response) => {
  try {
    let cfg = await SupportConfig.findOne();
    if (!cfg) cfg = await SupportConfig.create({});
    return res.json({ success: true, config: cfg.toObject() });
  } catch (err: any) {
    console.error('support/config error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load support config' });
  }
};

export const listPublicFaqs = async (req: Request, res: Response) => {
  try {
    const { q, category } = req.query as { q?: string; category?: string };
    const filter: Record<string, any> = { isActive: true };
    if (category) filter.category = category;

    const sort = { order: 1, createdAt: -1 } as const;

    const docs = q
      ? await SupportFaq.find(filter).find({ $text: { $search: String(q) } }).sort(sort).lean()
      : await SupportFaq.find(filter).sort(sort).lean();

    return res.json({ success: true, faqs: docs });
  } catch (err: any) {
    console.error('support/faqs error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load FAQs' });
  }
};
