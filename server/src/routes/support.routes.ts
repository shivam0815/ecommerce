import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { Types, SortOrder } from 'mongoose';
import SupportConfig from '../models/SupportConfig';
import SupportFaq from '../models/SupportFaq';
import SupportTicket from '../models/SupportTicket';
import { rateLimitSensitive } from '../middleware/auth';
import { upload, handleMulterError } from '../middleware/upload';

const router = Router();

type AuthedRequest = Request & { user?: { _id?: Types.ObjectId } };

// shared validation handler
const handleValidation = (req: Request, res: Response, _next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Helpful debug while you’re integrating:
    console.warn('VALIDATION_FAILED /support route', {
      body: req.body,
      files: (req as any).files?.length,
      errors: errors.array()
    });
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  _next();
};

// ---------------------------------------------------------------------------
// GET /api/support/config
router.get('/config', async (_req: Request, res: Response) => {
  try {
    let doc = await SupportConfig.findOne();     // no .lean() to avoid FlattenMaps TS warnings
    if (!doc) doc = await SupportConfig.create({});
    return res.json({ success: true, config: doc.toObject() });
  } catch (err: any) {
    console.error('support/config error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load support config' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/support/faqs?q=&category=
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

      const base = SupportFaq.find(filter).sort(sort).lean();
      const docs = q
        ? await SupportFaq.find(filter).find({ $text: { $search: String(q) } }).sort(sort).lean()
        : await base;

      return res.json({ success: true, faqs: docs });
    } catch (err: any) {
      console.error('support/faqs error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load FAQs' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/support/tickets  (multipart/form-data with field "attachments")
import type { RequestHandler } from 'express';
const postTicket: RequestHandler = async (req, res) => {
  try {
    const files = (req as any).files as Express.Multer.File[] | undefined;

    const attachments = (files || []).map((f) => ({
      url: (f as any).path || (f as any).location || (f as any).url || '',
      name: f.originalname,
      size: f.size,
      mime: f.mimetype,
    }));

    const userId = (req as AuthedRequest).user?._id;

    const doc = await SupportTicket.create({
      subject: req.body.subject,
      category: req.body.category,
      message: req.body.message,
      email: req.body.email,
      phone: req.body.phone,
      orderId: req.body.orderId,
      priority: (req.body.priority as any) || 'normal',
      channel: 'web',
      userId,
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
  rateLimitSensitive,
  upload.array('attachments', 3),
  handleMulterError,
  [
    body('subject').isString().trim().isLength({ min: 5 }),
    body('message').isString().trim().isLength({ min: 10 }),
    body('email').isEmail().normalizeEmail(),
    body('category').optional().isString(),
    body('phone').optional().isString(),
    body('orderId').optional().isString(),
    body('priority').optional().isIn(['low', 'normal', 'high']),
  ],
  handleValidation,
  postTicket
);

// ---------------------------------------------------------------------------
// GET /api/support/tickets/my  (requires req.user from your auth)
router.get('/tickets/my', async (req: AuthedRequest, res: Response) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Login required' });
    }

    const list = await SupportTicket.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, tickets: list });
  } catch (err: any) {
    console.error('support/tickets/my error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load tickets' });
  }
});

export default router;
