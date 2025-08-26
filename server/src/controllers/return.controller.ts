// controllers/return.controller.ts
import { Request, Response } from 'express';
import ReturnRequest from '../models/ReturnRequest';
import Order from '../models/Order'; // assumes you have this
import { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

const RETURN_WINDOW_DAYS = Number(process.env.RETURN_WINDOW_DAYS || 7);

// helper to check window
const withinReturnWindow = (deliveredAt?: Date) => {
  if (!deliveredAt) return false;
  const diff = Date.now() - new Date(deliveredAt).getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days <= RETURN_WINDOW_DAYS;
};

// ==== USER ====

export const createReturnRequest = async (req: any, res: Response) => {
  try {
    const userId = req.user._id as Types.ObjectId;
    const { orderId, items, reasonType, reasonNote, pickupAddress } = req.body as {
      orderId: string;
      items: Array<{ productId: string; orderItemId?: string; quantity: number; reason?: string }>;
      reasonType: any;
      reasonNote?: string;
      pickupAddress?: any;
    };

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order and items are required' });
    }

    const order = await Order.findOne({ _id: orderId, 'user._id': userId }) || await Order.findOne({ _id: orderId, user: userId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (String(order.status).toLowerCase() !== 'delivered' || !withinReturnWindow(order.deliveredAt || order.updatedAt)) {
      return res.status(400).json({ success: false, message: `Return window (${RETURN_WINDOW_DAYS} days) has expired or order not delivered` });
    }

    // Map items against order for price snapshot & qty validation
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const builtItems = items.map(it => {
      const match = orderItems.find((oi: any) =>
        it.orderItemId ? String(oi._id) === String(it.orderItemId) : String(oi.productId) === String(it.productId)
      );
      if (!match) throw new Error('Invalid item in request');
      if (it.quantity < 1 || it.quantity > (match.quantity || 1)) throw new Error('Invalid quantity');
      return {
        productId: new Types.ObjectId(it.productId || match.productId),
        orderItemId: match?._id,
        name: match?.name,
        quantity: it.quantity,
        unitPrice: Number(match?.price || match?.unitPrice || 0),
        reason: it.reason,
      };
    });

    const refundAmount = builtItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

    // Optional image uploads (multipart/form-data with files[] or image[] etc)
    const imageUrls: string[] = [];
    const files = (req.files as Express.Multer.File[]) || [];
    for (const f of files) {
      const up = await cloudinary.uploader.upload(f.path, { folder: 'returns' });
      imageUrls.push(up.secure_url);
    }

    const rr = await ReturnRequest.create({
      user: userId,
      order: order._id,
      status: 'pending',
      reasonType,
      reasonNote,
      items: builtItems,
      images: imageUrls,
      refundAmount,
      currency: 'INR',
      pickupAddress: pickupAddress || order.shippingAddress,
      history: [{ action: 'created', by: userId, note: reasonNote }]
    });

    // (optional) emit socket event to admin rooms
    req.io?.emit?.('returnCreated', { _id: rr._id, orderId: order._id });

    return res.json({ success: true, returnRequest: rr });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message || 'Failed to create return' });
  }
};

export const listMyReturns = async (req: any, res: Response) => {
  const userId = req.user._id;
  const list = await ReturnRequest.find({ user: userId }).sort({ createdAt: -1 });
  res.json({ success: true, returns: list });
};

export const getMyReturn = async (req: any, res: Response) => {
  const userId = req.user._id;
  const { id } = req.params;
  const r = await ReturnRequest.findOne({ _id: id, user: userId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, returnRequest: r });
};

export const cancelMyReturn = async (req: any, res: Response) => {
  const userId = req.user._id;
  const { id } = req.params;
  const r = await ReturnRequest.findOne({ _id: id, user: userId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (!['pending','approved'].includes(r.status)) {
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
    ReturnRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('user', 'name email').populate('order', 'orderNumber'),
    ReturnRequest.countDocuments(filter)
  ]);
  res.json({ success: true, returns: rows, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
};

export const adminGetReturn = async (req: Request, res: Response) => {
  const r = await ReturnRequest.findById(req.params.id).populate('user', 'name email phone').populate('order', 'orderNumber');
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, returnRequest: r });
};

export const adminDecision = async (req: any, res: Response) => {
  const { id } = req.params;
  const { action, adminNote } = req.body as { action: 'approve' | 'reject'; adminNote?: string };
  const r = await ReturnRequest.findById(id);
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (r.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed' });

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
  if (!['approved','in_transit','pickup_scheduled'].includes(r.status)) {
    return res.status(400).json({ success: false, message: 'Invalid status for receive' });
  }
  r.status = 'received';
  r.history.push({ at: new Date(), by: req.user._id, action: 'received', note });
  await r.save();
  req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
  res.json({ success: true, returnRequest: r });
};

export const adminRefund = async (req: any, res: Response) => {
  const { id } = req.params;
  const { method, reference } = req.body as { method: 'original' | 'wallet' | 'manual'; reference?: string };
  const r = await ReturnRequest.findById(id);
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (!['received','refund_initiated'].includes(r.status)) {
    return res.status(400).json({ success: false, message: 'Return not received yet' });
  }
  r.status = 'refund_completed';
  r.refund = { method, reference, at: new Date() };
  r.history.push({ at: new Date(), by: req.user._id, action: 'refund_completed', note: reference });
  await r.save();
  req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
  res.json({ success: true, returnRequest: r });
};
