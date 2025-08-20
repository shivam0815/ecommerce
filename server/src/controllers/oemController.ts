import { Request, Response } from 'express';
import mongoose from 'mongoose';
import OEMInquiry from '../models/OEMInquiry';
import nodemailer from 'nodemailer';

/* --------------------------- SMTP / Mailer --------------------------- */
const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_FROM || SMTP_USER || 'no-reply@example.com';

// secure = true for 465; otherwise false
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

/* ------------------------------ Helpers ------------------------------ */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const phoneRegex = /^\+?[0-9]{7,15}$/; // allow +country and 7–15 digits

function bad(res: Response, message: string, code = 400) {
  return res.status(code).json({ success: false, message });
}

/* ----------------------------- Controllers --------------------------- */
export const createOEMInquiry = async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      phone,
      productCategory,
      quantity,
      customization,
      message,
    } = req.body ?? {};

    // Basic server-side validation (mirrors schema + UX)
    if (!companyName?.trim()) return bad(res, 'Company name is required');
    if (!contactPerson?.trim()) return bad(res, 'Contact person is required');
    if (!emailRegex.test(String(email || '').trim())) return bad(res, 'Valid email is required');
    if (!phoneRegex.test(String(phone || '').replace(/\s+/g, ''))) return bad(res, 'Valid phone is required');
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 100) return bad(res, 'Quantity must be an integer ≥ 100');
    if (!customization?.trim()) return bad(res, 'Customization details are required');
    if (!productCategory?.trim()) return bad(res, 'Product category is required');

    // Save to DB
    const inquiry = await OEMInquiry.create({
      companyName,
      contactPerson,
      email,
      phone: String(phone).replace(/\s+/g, ''),
      productCategory,
      quantity: qty,
      customization,
      message,
    });

    // Fire emails (guarded)
    const adminHtml = `
      <h2>New OEM Inquiry Received</h2>
      <p><strong>Company:</strong> ${inquiry.companyName}</p>
      <p><strong>Contact Person:</strong> ${inquiry.contactPerson}</p>
      <p><strong>Email:</strong> ${inquiry.email}</p>
      <p><strong>Phone:</strong> ${inquiry.phone}</p>
      <p><strong>Product Category:</strong> ${inquiry.productCategory}</p>
      <p><strong>Quantity:</strong> ${inquiry.quantity}</p>
      <p><strong>Customization:</strong> ${inquiry.customization}</p>
      ${inquiry.message ? `<p><strong>Message:</strong> ${inquiry.message}</p>` : ''}
      <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
    `;

    const customerHtml = `
      <h2>Thank you for your OEM inquiry!</h2>
      <p>Dear ${inquiry.contactPerson},</p>
      <p>We’ve received your OEM inquiry for <strong>${inquiry.productCategory}</strong>. Our team will review your requirements and get back to you within 24–48 hours.</p>
      <p><strong>Summary</strong></p>
      <ul>
        <li>Company: ${inquiry.companyName}</li>
        <li>Product Category: ${inquiry.productCategory}</li>
        <li>Quantity: ${inquiry.quantity}</li>
        <li>Customization: ${inquiry.customization}</li>
      </ul>
      <p>Best regards,<br/>Nakoda Mobile Team</p>
    `;

    // Only attempt to send if SMTP is configured
    if (SMTP_HOST && SMTP_USER) {
      // Admin notification
      transporter
        .sendMail({
          from: FROM_EMAIL,
          to: FROM_EMAIL, // admin inbox
          subject: 'New OEM Inquiry - Nakoda Mobile',
          html: adminHtml,
          replyTo: inquiry.email,
        })
        .catch((err) => console.error('Admin email error:', err));

      // Customer confirmation
      transporter
        .sendMail({
          from: FROM_EMAIL,
          to: inquiry.email,
          subject: 'OEM Inquiry Received - Nakoda Mobile',
          html: customerHtml,
          replyTo: FROM_EMAIL,
        })
        .catch((err) => console.error('Customer email error:', err));
    } else {
      console.warn('[OEM] SMTP not configured; skipping emails.');
    }

    return res.status(201).json({
      success: true,
      message: 'OEM inquiry submitted successfully. We will contact you soon.',
      inquiry: {
        id: inquiry._id,
        companyName: inquiry.companyName,
        contactPerson: inquiry.contactPerson,
        status: inquiry.status,
        createdAt: inquiry.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Create OEM inquiry error:', error);
    // Mongoose validation errors -> 400
    if (error?.name === 'ValidationError') {
      return bad(res, error.message, 400);
    }
    return bad(res, 'Server error', 500);
  }
};

export const getOEMInquiries = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const status = req.query.status as string | undefined;

    const query: Record<string, any> = {};
    if (status) query.status = status;

    const [inquiries, total] = await Promise.all([
      OEMInquiry.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      OEMInquiry.countDocuments(query),
    ]);

    return res.json({
      success: true,
      inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('Get OEM inquiries error:', error);
    return bad(res, 'Server error', 500);
  }
};

export const updateOEMInquiry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: string };

    if (!mongoose.isValidObjectId(id)) return bad(res, 'Invalid inquiry id', 400);
    const allowed = ['pending', 'contacted', 'quoted', 'closed'];
    if (!status || !allowed.includes(status)) return bad(res, 'Invalid status', 400);

    const inquiry = await OEMInquiry.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!inquiry) return bad(res, 'Inquiry not found', 404);

    return res.json({ success: true, message: 'Inquiry status updated', inquiry });
  } catch (error) {
    console.error('Update OEM inquiry error:', error);
    return bad(res, 'Server error', 500);
  }
};
