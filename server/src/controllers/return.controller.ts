// backend/src/controllers/return.controller.ts
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Order from '../models/Order';
import ReturnRequest from '../models/ReturnRequest';
import { v2 as cloudinary } from 'cloudinary';
import Razorpay from 'razorpay';
const RETURN_WINDOW_DAYS = Number(process.env.RETURN_WINDOW_DAYS || 7);
const razor = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const withinReturnWindow = (deliveredAt?: Date) => {
  if (!deliveredAt) return false;
  const diffMs = Date.now() - new Date(deliveredAt).getTime();
  return diffMs / (1000 * 60 * 60 * 24) <= RETURN_WINDOW_DAYS;
};

// What we expect an order item to minimally look like.
type OrderItem = {
  _id?: any;            // may be absent in some orders
  id?: any;             // fallback some apps use
  productId: string | Types.ObjectId;
  quantity: number;
  price?: number;       // preferred per-unit price
  unitPrice?: number;   // legacy fallback
  name?: string;
  image?: string;
};

type IncomingItem = {
  productId?: string;
  orderItemId?: string;
  quantity: number;
  reason?: string;
};

export const createReturnRequest = async (req: any, res: Response) => {
  try {
    // 1) Auth guard
    const authUserId: string | undefined = req.user?._id || req.user?.id;
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 2) Parse body; items may arrive stringified when using FormData
    const body = req.body || {};
    const orderId: string = body.orderId;
    const reasonType: string = body.reasonType;
    const reasonNote: string | undefined = body.reasonNote;

    const itemsPayload: IncomingItem[] =
      typeof body.items === 'string' ? JSON.parse(body.items) : body.items;

    const pickupAddress =
      typeof body.pickupAddress === 'string'
        ? JSON.parse(body.pickupAddress)
        : body.pickupAddress;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }
    if (!Array.isArray(itemsPayload) || itemsPayload.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }
    if (!reasonType) {
      return res.status(400).json({ success: false, message: 'reasonType is required' });
    }

    // 3) Fetch order. Your schema uses userId; keep fallbacks for old docs.
    const order =
      (await Order.findOne({ _id: orderId, userId: authUserId })) ||
      (await Order.findOne({ _id: orderId, user: authUserId })) ||
      (await Order.findOne({ _id: orderId, 'user._id': authUserId }));

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Must be delivered & within return window
    const status = String((order as any).orderStatus || order.status || '').toLowerCase();
    const deliveredAt = (order as any).deliveredAt || (order as any).updatedAt;
    if (status !== 'delivered' || !withinReturnWindow(deliveredAt)) {
      return res.status(400).json({
        success: false,
        message: `Return window (${RETURN_WINDOW_DAYS} days) has expired or order not delivered`,
      });
    }

    // 4) Build items strictly from order data (do NOT trust client productId)
    const orderItems: OrderItem[] = Array.isArray((order as any).items)
      ? (order as any).items
      : [];

    const builtItems = itemsPayload.map((it) => {
      const match = orderItems.find((oi) =>
        it.orderItemId
          ? String(oi._id ?? oi.id ?? '') === String(it.orderItemId)
          : it.productId
          ? String(oi.productId) === String(it.productId)
          : false
      );

      if (!match) throw new Error('Invalid item in request');

      const purchasedQty = Number(match.quantity || 1);
      const reqQty = Number(it.quantity || 0);
      if (!Number.isFinite(reqQty) || reqQty < 1 || reqQty > purchasedQty) {
        throw new Error('Invalid quantity');
      }

      // Ensure a valid ObjectId for productId from the ORDER (not the client)
      const rawPid = String((match as any).productId);
      if (!Types.ObjectId.isValid(rawPid)) {
        throw new Error('Invalid productId stored on order');
      }

      // Price snapshot: prefer `price` then `unitPrice`, else 0
      const unitPrice = Number((match as any).price ?? (match as any).unitPrice ?? 0);
      if (!Number.isFinite(unitPrice)) {
        throw new Error('Invalid price on order item');
      }

      return {
        productId: new Types.ObjectId(rawPid),
        orderItemId: (match as any)._id ?? (match as any).id,
        name: match.name,
        quantity: reqQty,
        unitPrice,
        reason: it.reason,
      };
    });

    const refundAmount = builtItems.reduce(
      (sum, it: any) => sum + Number(it.unitPrice || 0) * Number(it.quantity || 0),
      0
    );

    // 5) Optional images (multer: req.files or req.files.images[])
    const imageUrls: string[] = [];
    const files: Express.Multer.File[] = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : ((req.files && (req.files as any).images) as Express.Multer.File[]) || [];

    for (const f of files) {
      const up = await cloudinary.uploader.upload(f.path, { folder: 'returns' });
      imageUrls.push(up.secure_url);
    }

    // 6) Create ReturnRequest
    const rr = await ReturnRequest.create({
      user: authUserId,
      order: (order as any)._id,
      status: 'pending',
      reasonType,
      reasonNote,
      items: builtItems,
      images: imageUrls,
      refundAmount,
      currency: 'INR',
      pickupAddress: pickupAddress || (order as any).shippingAddress,
      history: [{ at: new Date(), action: 'created', by: authUserId, note: reasonNote }],
    });

    // 7) Optional socket notify
    req.io?.emit?.('returnCreated', { _id: rr._id, orderId: (order as any)._id });

    return res.json({ success: true, returnRequest: rr });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e?.message || 'Failed to create return' });
  }
};

export const listMyReturns = async (req: any, res: Response) => {
  const userId = req.user?._id || req.user?.id;
  const list = await ReturnRequest.find({ user: userId }).sort({ createdAt: -1 });
  res.json({ success: true, returns: list });
};

export const getMyReturn = async (req: any, res: Response) => {
  const userId = req.user?._id || req.user?.id;
  const { id } = req.params;
  const r = await ReturnRequest.findOne({ _id: id, user: userId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, returnRequest: r });
};

export const cancelMyReturn = async (req: any, res: Response) => {
  const userId = req.user?._id || req.user?.id;
  const { id } = req.params;
  const r = await ReturnRequest.findOne({ _id: id, user: userId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (!['pending', 'approved'].includes(r.status)) {
    return res.status(400).json({ success: false, message: 'Cannot cancel at this stage' });
  }
  r.status = 'cancelled';
  r.history.push({ at: new Date(), by: userId, action: 'cancelled' });
  await r.save();
  req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
  res.json({ success: true, returnRequest: r });
};

// ==== ADMIN ====

export const adminListReturns = async (req: any, res: Response) => {
  const { status, q, page = 1, limit = 20 } = req.query as any;
  const filter: any = {};
  if (status) filter.status = status;
  if (q) filter.$text = { $search: q };

  const skip = (Number(page) - 1) * Number(limit);
  const [rows, total] = await Promise.all([
    ReturnRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name email')
      .populate('order', 'orderNumber'),
    ReturnRequest.countDocuments(filter),
  ]);

  res.json({
    success: true,
    returns: rows,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  });
};

export const adminGetReturn = async (req: Request, res: Response) => {
  const r = await ReturnRequest.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('order', 'orderNumber');
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, returnRequest: r });
};

export const adminDecision = async (req: any, res: Response) => {
  const { id } = req.params;
  const { action, adminNote } = req.body as { action: 'approve' | 'reject'; adminNote?: string };
  const r = await ReturnRequest.findById(id);
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (r.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Already processed' });
  }

  if (action === 'approve') r.status = 'approved';
  if (action === 'reject') r.status = 'rejected';
  r.adminNote = adminNote;
  r.history.push({ at: new Date(), by: req.user._id, action, note: adminNote });
  await r.save();
  req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
  res.json({ success: true, returnRequest: r });
};

export const adminMarkReceived = async (req: any, res: Response) => {
  const { id } = req.params;
  const { note } = req.body as { note?: string };
  const r = await ReturnRequest.findById(id);
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (!['approved', 'in_transit', 'pickup_scheduled'].includes(r.status)) {
    return res.status(400).json({ success: false, message: 'Invalid status for receive' });
  }
  r.status = 'received';
  r.history.push({ at: new Date(), by: req.user._id, action: 'received', note });
  await r.save();
  req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
  res.json({ success: true, returnRequest: r });
};

export const adminRefund = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { method, reference } = req.body as { method: 'original'|'wallet'|'manual'; reference?: string };

    const r = await ReturnRequest.findById(id);
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['received','refund_initiated'].includes(r.status))
      return res.status(400).json({ success: false, message: 'Return not received yet' });

    const order = await Order.findById(r.order).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    let refundInfo: any = { method, reference };

    if (method === 'original') {
      if (String(order.paymentMethod) !== 'razorpay' || !order.paymentId) {
        return res.status(400).json({ success: false, message: 'Original refund not possible for this order' });
      }
      const amountPaise = Math.round((r.refundAmount || order.total || 0) * 100);
      const refund = await razor.payments.refund(order.paymentId, {
        amount: amountPaise,
        speed: 'optimum',
        notes: { returnId: String(r._id) },
      });
      refundInfo.razorpay = { id: refund.id, status: refund.status, amount: refund.amount, created_at: refund.created_at };
    }

    r.status = 'refund_completed';
    r.refund = { ...refundInfo, at: new Date() };
    r.history.push({ at: new Date(), by: req.user._id, action: 'refund_completed', note: reference });
    await r.save();

    req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
    return res.json({ success: true, returnRequest: r });
  } catch (e: any) {
    console.error('adminRefund error', e);
    return res.status(400).json({ success: false, message: e?.message || 'Refund failed' });
  }
};