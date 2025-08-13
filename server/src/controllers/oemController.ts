import { Request, Response } from 'express';
import OEMInquiry from '../models/OEMInquiry';
import nodemailer from 'nodemailer';

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
      message
    } = req.body;
    
    const inquiry = new OEMInquiry({
      companyName,
      contactPerson,
      email,
      phone,
      productCategory,
      quantity,
      customization,
      message
    });
    
    await inquiry.save();
    
    // Send email notification to admin
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Admin email
        subject: 'New OEM Inquiry - Nakoda Mobile',
        html: `
          <h2>New OEM Inquiry Received</h2>
          <p><strong>Company:</strong> ${companyName}</p>
          <p><strong>Contact Person:</strong> ${contactPerson}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Product Category:</strong> ${productCategory}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Customization:</strong> ${customization}</p>
          <p><strong>Message:</strong> ${message}</p>
          <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        `
      });
    } catch (emailError) {
      console.error('Email notification error:', emailError);
    }
    
    // Send confirmation email to customer
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OEM Inquiry Received - Nakoda Mobile',
        html: `
          <h2>Thank you for your OEM inquiry!</h2>
          <p>Dear ${contactPerson},</p>
          <p>We have received your OEM inquiry for ${productCategory} products. Our team will review your requirements and get back to you within 24-48 hours.</p>
          <p><strong>Inquiry Details:</strong></p>
          <ul>
            <li>Company: ${companyName}</li>
            <li>Product Category: ${productCategory}</li>
            <li>Quantity: ${quantity}</li>
            <li>Customization: ${customization}</li>
          </ul>
          <p>Best regards,<br>Nakoda Mobile Team</p>
        `
      });
    } catch (emailError) {
      console.error('Customer email error:', emailError);
    }
    
    res.status(201).json({
      message: 'OEM inquiry submitted successfully. We will contact you soon.',
      inquiry: {
        id: inquiry._id,
        companyName: inquiry.companyName,
        contactPerson: inquiry.contactPerson,
        status: inquiry.status
      }
    });
  } catch (error: any) {
    console.error('Create OEM inquiry error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getOEMInquiries = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const query: any = {};
    if (status) {
      query.status = status;
    }
    
    const inquiries = await OEMInquiry.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit));
    
    const total = await OEMInquiry.countDocuments(query);
    
    res.json({
      inquiries,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total
    });
  } catch (error) {
    console.error('Get OEM inquiries error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateOEMInquiry = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    const inquiry = await OEMInquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }
    
    res.json({
      message: 'Inquiry status updated',
      inquiry
    });
  } catch (error) {
    console.error('Update OEM inquiry error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};