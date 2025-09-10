// src/controllers/shipping.controller.ts
import { Request, Response } from 'express';
import Razorpay from '../config/razorpay';
import Order, { IOrder } from '../models/Order';
import email from '../config/emailService'; // default export is the instance

const asNum = (v: any) => (v === '' || v == null ? undefined : Number(v));

/**
 * Admin sets package dims/weight/images and (optionally) creates a shipping Payment Link.
 * Body:
 * {
 *   lengthCm, breadthCm, heightCm, weightKg, notes, images: string[],
 *   amount, currency, createPaymentLink: boolean
 * }
 */
export async function setPackageAndMaybeLink(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      lengthCm, breadthCm, heightCm, weightKg, notes, images,
      amount, currency = 'INR', createPaymentLink
    } = req.body ?? {};

    const order = (await Order.findById(id)) as IOrder | null;
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Save package
    order.shippingPackage = {
      lengthCm: asNum(lengthCm),
      breadthCm: asNum(breadthCm),
      heightCm: asNum(heightCm),
      weightKg: asNum(weightKg),
      notes,
      images: Array.isArray(images) ? images.slice(0, 5) : order.shippingPackage?.images || [],
      packedAt: new Date(),
    };

    // Optionally create/refresh payment link
    if (createPaymentLink && Number(amount) > 0) {
      const link = await Razorpay.paymentLink.create({
        amount: Math.round(Number(amount) * 100),
        currency,
        accept_partial: false,
        description: `Shipping charges for order ${order.orderNumber}`,
        customer: {
          name: order.shippingAddress.fullName,
          email: order.shippingAddress.email,
          contact: order.shippingAddress.phoneNumber,
        },
        notify: { sms: true, email: true },
        // 👇 FIX: coerce _id (unknown) to string
        notes: { orderId: String(order._id), purpose: 'shipping_payment' },
        reminder_enable: true,
        // 👇 FIX: coerce _id (unknown) to string
        callback_url: `${process.env.APP_BASE_URL}/orders/${String(order._id)}`,
        callback_method: 'get',
      });

      order.shippingPayment = {
        linkId: link.id,
        shortUrl: link.short_url,
        status: 'pending',
        currency,
        amount: Number(amount),
        amountPaid: 0,
        paymentIds: [],
      };

      // email+SMS with full payload (dimensions, weight, photos)
      await email.sendShippingPaymentLink(order, {
        amount: Number(amount),
        currency,
        shortUrl: link.short_url,
        linkId: link.id,
        lengthCm: asNum(lengthCm),
        breadthCm: asNum(breadthCm),
        heightCm: asNum(heightCm),
        weightKg: asNum(weightKg),
        notes,
        images: Array.isArray(images) ? images.slice(0, 5) : undefined,
      });
    }

    await order.save();
    res.json({ success: true, order });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

/** Create/refresh the shipping payment link explicitly */
export async function createShippingPaymentLink(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount, currency = 'INR' } = req.body ?? {};
    if (!(Number(amount) > 0)) return res.status(400).json({ message: 'amount required' });

    const order = (await Order.findById(id)) as IOrder | null;
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const link = await Razorpay.paymentLink.create({
      amount: Math.round(Number(amount) * 100),
      currency,
      accept_partial: false,
      description: `Shipping charges for order ${order.orderNumber}`,
      customer: {
        name: order.shippingAddress.fullName,
        email: order.shippingAddress.email,
        contact: order.shippingAddress.phoneNumber,
      },
      notify: { sms: true, email: true },
      // 👇 FIX: coerce _id (unknown) to string
      notes: { orderId: String(order._id), purpose: 'shipping_payment' },
      reminder_enable: true,
      // 👇 FIX: coerce _id (unknown) to string
      callback_url: `${process.env.APP_BASE_URL}/orders/${String(order._id)}`,
      callback_method: 'get',
    });

    order.shippingPayment = {
      linkId: link.id,
      shortUrl: link.short_url,
      status: 'pending',
      currency,
      amount: Number(amount),
      amountPaid: 0,
      paymentIds: [],
    };

    await order.save();

    // include package info if already saved, so the email shows dims/photos
    const pkg = order.shippingPackage || {};
    await email.sendShippingPaymentLink(order, {
      amount: Number(amount),
      currency,
      shortUrl: link.short_url,
      linkId: link.id,
      lengthCm: pkg.lengthCm,
      breadthCm: pkg.breadthCm,
      heightCm: pkg.heightCm,
      weightKg: pkg.weightKg,
      notes: pkg.notes,
      images: (pkg.images || []).slice(0, 5),
    });

    // 👇 FIX: coerce _id (unknown) to string in response payload
    res.json({ success: true, link: { id: link.id, shortUrl: link.short_url }, orderId: String(order._id) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}
