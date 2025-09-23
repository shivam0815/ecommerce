// routes/support.routes.ts
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body, query, validationResult } from 'express-validator';
import { SortOrder } from 'mongoose';
import SupportConfig from '../models/SupportConfig';
import SupportFaq from '../models/SupportFaq';
import SupportTicket from '../models/SupportTicket';
import { rateLimitSensitive, authenticate, optionalAuthenticate } from '../middleware/auth';
import { upload, handleMulterError } from '../middleware/upload';

const router = Router();

/* -------------------------------------------------------------------------- */
/*                            Shared Validation Hook                           */
/* -------------------------------------------------------------------------- */

const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn('VALIDATION_FAILED /support', {
      body: req.body,
      files: (req as any).files?.length,
      errors: errors.array(),
    });
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

/* Small helpers to accept JSON strings, single strings, or arrays */
const toArray = (val: any): any[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      // it's a plain URL string (or comma separated)
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

/* -------------------------------------------------------------------------- */
/*                           GET /api/support/config                           */
/* -------------------------------------------------------------------------- */

router.get('/config', async (_req: Request, res: Response) => {
  try {
    let doc = await SupportConfig.findOne();
    if (!doc) doc = await SupportConfig.create({});
    return res.json({ success: true, config: doc.toObject() });
  } catch (err: any) {
    console.error('support/config error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load support config' });
  }
});

/* -------------------------------------------------------------------------- */
/*                       GET /api/support/faqs?q=&category=                    */
/* -------------------------------------------------------------------------- */

router.get(
  '/faqs',
  [query('q').optional().isString(), query('category').optional().isString()],
  handleValidation,
  async (req: Request, res: Response) => {
    try {
      const { q, category } = req.query as { q?: string; category?: string };

      const filter: Record<string, any> = { isActive: true };
      if (category) filter.category = category;

      const sort: Record<string, SortOrder> = { order: 1, createdAt: -1 };

      const docs = q
        ? await SupportFaq.find(filter).find({ $text: { $search: String(q) } }).sort(sort).lean()
        : await SupportFaq.find(filter).sort(sort).lean();

      return res.json({ success: true, faqs: docs });
    } catch (err: any) {
      console.error('support/faqs error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load FAQs' });
    }
  }
);

/* -------------------------------------------------------------------------- */
/*          POST /api/support/tickets  (files OR pre-uploaded S3 URLs)         */
/*     Uses optionalAuthenticate so logged-in users get userId attached.       */
/* -------------------------------------------------------------------------- */

const postTicket: RequestHandler = async (req, res) => {
  try {
    // 1) Files uploaded via multer (field: "attachments")
    const files = (req as any).files as Express.Multer.File[] | undefined;
    const fileAtts =
      (files || [])
        .map((f) => ({
          url: (f as any).path || (f as any).location || (f as any).url || '',
          name: f.originalname,
          size: f.size,
          mime: f.mimetype,
        }))
        .filter(a => a.url);

    // 2) URLs provided in body (S3 pre-upload flow)
    const bodyRaw = [
      ...toArray((req.body as any).attachments),      // [{url,name,...}] or single URL
      ...toArray((req.body as any).attachmentsUrls),  // preferred payload
    ];
    const bodyAtts = bodyRaw.map(normalizeAtt).filter((a) => a && a.url);

    const attachments = [...fileAtts, ...bodyAtts];

    // If user is logged in, optionalAuthenticate will have set req.user
    const authedUser = (req as any).user as { id?: string; email?: string } | undefined;

    // Email can come from either body or logged-in user
    const finalEmail = (req.body.email || authedUser?.email || '').trim();
    if (!finalEmail) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: [{ msg: 'Email is required', param: 'email', location: 'body' }],
      });
    }

    const doc = await SupportTicket.create({
      subject: req.body.subject,
      category: req.body.category,
      message: req.body.message,
      email: finalEmail,
      phone: req.body.phone || undefined,
      orderId: req.body.orderId || undefined,
      priority: (req.body.priority as any) || 'normal',
      channel: 'web',
      userId: authedUser?.id, // Mongoose can cast string -> ObjectId
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

router.post(
  '/tickets',
  optionalAuthenticate,
  rateLimitSensitive,
  upload.array('attachments', 6), // still supports direct file upload
  handleMulterError,
  [
    body('subject').isString().trim().isLength({ min: 3 }).withMessage('Subject is required'),
    body('message').isString().trim().isLength({ min: 5 }).withMessage('Message is required'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('category').optional().isString(),
    body('phone').optional().isString(),
    body('orderId').optional().isString(),
    body('priority').optional().isIn(['low', 'normal', 'high']),
    // Accept URL payloads too (can be JSON string or array); we don't hard-validate shape
    body('attachments').optional(),
    body('attachmentsUrls').optional(),
  ],
  handleValidation,
  postTicket
);

/* -------------------------------------------------------------------------- */
/*                 GET /api/support/tickets/my  (Requires auth)                */
/* -------------------------------------------------------------------------- */

router.get('/tickets/my', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Login required' });
    }

    const tickets = await SupportTicket.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json({ success: true, tickets });
  } catch (err: any) {
    console.error('support/tickets/my error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load tickets' });
  }
});

export default router;
