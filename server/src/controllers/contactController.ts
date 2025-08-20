import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import ContactMessage from '../models/ContactMessage';

// Support either SMTP_* or EMAIL_* env names
const HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
const SECURE = String(PORT) === '465';
const USER = process.env.SMTP_USER || process.env.EMAIL_USER;
const PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const FROM = process.env.FROM_EMAIL || USER || 'no-reply@example.com';

const transporter = nodemailer.createTransport({
  host: HOST,
  port: PORT,
  secure: SECURE,
  auth: USER && PASS ? { user: USER, pass: PASS } : undefined,
});

export const createContactMessage = async (req: Request, res: Response) => {
  try {
    // Honeypot: if present, silently accept but do nothing
    if (req.body.website) {
      return res.status(200).json({ message: 'Thanks! We will get back to you.' });
    }

    const { name, email, phone, subject, message } = req.body;

    const doc = new ContactMessage({
      name,
      email,
      phone,
      subject,
      message,
      meta: { ip: req.ip, userAgent: req.get('user-agent') || '' },
    });
    await doc.save();

    // Admin notification (fail-safe)
    const adminTo = process.env.CONTACT_ADMIN_TO || USER;
    if (adminTo) {
      transporter
        .sendMail({
          from: FROM,
          to: adminTo,
          subject: `New Contact Message (${subject}) - ${name}`,
          html: `
            <h2>New Contact Message</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || '-'}</p>
            <p><strong>Department:</strong> ${subject}</p>
            <p><strong>Message:</strong><br/>${(message || '').replace(/\n/g, '<br/>')}</p>
            <hr/>
            <p><strong>IP:</strong> ${req.ip}</p>
            <p><strong>User-Agent:</strong> ${req.get('user-agent') || ''}</p>
            <p>Submitted: ${new Date().toLocaleString()}</p>
          `,
        })
        .catch(err => console.error('Contact admin email error:', err));
    }

    // User acknowledgement (fail-safe)
    transporter
      .sendMail({
        from: FROM,
        to: email,
        subject: 'We received your message — Nakoda Mobile',
        html: `
          <p>Hi ${name},</p>
          <p>Thanks for reaching out to Nakoda Mobile. We’ve received your message and our team will reply shortly.</p>
          <p><strong>Summary:</strong></p>
          <ul>
            <li>Department: ${subject}</li>
            <li>Phone: ${phone || '-'}</li>
          </ul>
          <p><em>Your message:</em><br/>${(message || '').replace(/\n/g, '<br/>')}</p>
          <p>Best regards,<br/>Nakoda Mobile Support</p>
        `,
      })
      .catch(err => console.error('Contact user email error:', err));

    res.status(201).json({
      message: 'Message sent successfully! We’ll get back to you soon.',
      id: doc._id,
      status: doc.status,
    });
  } catch (error: any) {
    console.error('Create contact error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getContactMessages = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const status = req.query.status as string | undefined;

    const q: any = {};
    if (status) q.status = status;

    const [items, total] = await Promise.all([
      ContactMessage.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      ContactMessage.countDocuments(q),
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateContactMessage = async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: ContactStatus };
    const updated = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Status updated', item: updated });
  } catch (error) {
    console.error('Update contact message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
