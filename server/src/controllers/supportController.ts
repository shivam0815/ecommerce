import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import SupportTicket from '../models/SupportTicket';
import SupportConfig from '../models/SupportConfig';
import SupportFaq from '../models/SupportFaq';

/** If your auth middleware sets req.user */
type AuthedRequest = Request & { user?: { _id?: Types.ObjectId } };

/**
 * POST /api/support/tickets
 * Public – creates a support ticket from multipart/form-data.
 * Expects fields: subject, message, email, (optional) phone, orderId, category, priority
 * Attachments come from upload.array('attachments', 3)
 */
export const createSupportTicket = async (req: AuthedRequest, res: Response) => {
  try {
    // Multer shapes:
    // - upload.array -> req.files as Express.Multer.File[]
    // - upload.fields -> req.files as { [fieldname: string]: Express.Multer.File[] }
    const files = (req.files as Express.Multer.File[]) ?? [];

    // Defensive trim on all text fields (even though express-validator runs upstream)
    const subject  = String(req.body.subject ?? '').trim();
    const message  = String(req.body.message ?? '').trim();
    const email    = String(req.body.email ?? '').trim();
    const phone    = req.body.phone ? String(req.body.phone).trim() : undefined;
    const orderId  = req.body.orderId ? String(req.body.orderId).trim() : undefined;
    const category = req.body.category ? String(req.body.category).trim() : undefined;
    const priority = (req.body.priority as 'low'|'normal'|'high'|undefined) ?? 'normal';

    // Minimal runtime guard (validators should have run already)
    if (!subject || subject.length < 5) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: [{ msg: 'subject must be at least 5 chars' }] });
    }
    if (!message || message.length < 10) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: [{ msg: 'message must be at least 10 chars' }] });
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: [{ msg: 'email must be valid' }] });
    }

    const attachments = files.map((f) => ({
      // Depending on your storage engine (disk/S3):
      url: (f as any).path || (f as any).location || (f as any).url || '',
      name: f.originalname,
      size: f.size,
      mime: f.mimetype,
    }));

    const doc = await SupportTicket.create({
      subject,
      category,
      message,
      email,
      phone,
      orderId,
      priority,
      channel: 'web',
      userId: req.user?._id,
      attachments,
    });

    return res
      .status(201)
      .json({ success: true, ticket: { _id: doc._id, status: doc.status } });
  } catch (err: any) {
    console.error('support/tickets create error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to create ticket' });
  }
};

/* (Optional) other handlers you might want nearby */

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

    const base = SupportFaq.find(filter).sort(sort).lean();
    const docs = q
      ? await SupportFaq.find(filter).find({ $text: { $search: String(q) } }).sort(sort).lean()
      : await base;

    return res.json({ success: true, faqs: docs });
  } catch (err: any) {
    console.error('support/faqs error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load FAQs' });
  }
};
