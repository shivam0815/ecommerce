// src/services/emailService.ts - FIXED VERSION
import nodemailer from 'nodemailer';

export interface IUser {
  name: string;
  email: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("SMTP_PASS:", process.env.SMTP_PASS ? "✅ Exists" : "❌ MISSING");
    console.log("SMTP_HOST:", process.env.SMTP_HOST);
    console.log("SMTP_PORT:", process.env.SMTP_PORT);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection successful');
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
    }
  }

  private async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: `"Nakoda Mobile" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      });
      
      console.log('📧 Email sent successfully to:', options.to);
      console.log('📋 Message ID:', info.messageId);
      
    } catch (error: any) {
      console.error('❌ Email sending failed:', error);
      if (error.code) console.error('Error code:', error.code);
      if (error.response) console.error('SMTP response:', error.response);
      throw error;
    }
  }

  // Email Verification OTP Method
  async sendVerificationOtp(user: IUser, otp: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification Code - Nakoda Mobile</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: white; 
            border-radius: 10px; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
          }
          .header { 
            background: linear-gradient(135deg, #16a34a, #059669); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0; 
            margin: -20px -20px 30px -20px;
          }
          .otp-container { 
            text-align: center; 
            margin: 30px 0; 
            padding: 30px; 
            background: #f0f9ff; 
            border-radius: 12px; 
            border: 2px dashed #16a34a; 
          }
          .otp-code { 
            display: inline-block; 
            background: #16a34a; 
            color: white; 
            padding: 20px 40px; 
            font-size: 32px; 
            font-weight: bold; 
            letter-spacing: 5px; 
            border-radius: 8px; 
            font-family: monospace;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #ddd; 
            color: #666; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Email Verification</h1>
            <p>Secure your Nakoda Mobile account</p>
          </div>
          
          <div style="padding: 20px;">
            <h2>Hello ${user.name}!</h2>
            <p>Thank you for creating an account with Nakoda Mobile. Use the verification code below:</p>
            
            <div class="otp-container">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #16a34a;">Your Verification Code</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Enter this code to verify your email</p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <strong>Important:</strong>
              <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                <li>This code expires in <strong>10 minutes</strong></li>
                <li>You have <strong>5 attempts</strong> to enter it correctly</li>
                <li><strong>Never share</strong> this code with anyone</li>
              </ul>
            </div>
            
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          
          <div class="footer">
            <p><strong>Best regards,<br>The Nakoda Mobile Team</strong></p>
            <p>© 2025 Nakoda Mobile. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hello ${user.name}!

Your Nakoda Mobile verification code is: ${otp}

This code will expire in 10 minutes.
Enter this code in the verification form to complete registration.

If you didn't create an account, please ignore this email.

Best regards,
The Nakoda Mobile Team
    `;

    await this.sendEmail({
      to: user.email,
      subject: '🔐 Your Verification Code - Nakoda Mobile',
      html,
      text
    });
  }

  // Password Reset OTP Method
  async sendPasswordResetOtp(user: IUser, otp: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset Code - Nakoda Mobile</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: white; 
            border-radius: 10px; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
          }
          .header { 
            background: linear-gradient(135deg, #dc2626, #b91c1c); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0; 
            margin: -20px -20px 30px -20px;
          }
          .otp-code { 
            display: inline-block; 
            background: #dc2626; 
            color: white; 
            padding: 20px 40px; 
            font-size: 32px; 
            font-weight: bold; 
            letter-spacing: 5px; 
            border-radius: 8px; 
            font-family: monospace;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            color: #666; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Password Reset Request</h1>
          </div>
          <div style="padding: 20px;">
            <h2>Hello ${user.name}!</h2>
            <p>We received a request to reset your password. Use the code below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div class="otp-code">${otp}</div>
            </div>
            <p><strong>Important:</strong> This code expires in 10 minutes.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Nakoda Mobile Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject: '🔒 Password Reset Code - Nakoda Mobile',
      html,
      text: `Hello ${user.name}! Your password reset code is: ${otp} (expires in 10 minutes)`
    });
  }

  // Legacy methods for backward compatibility
  async sendVerificationEmail(user: IUser, otp: string): Promise<void> {
    return this.sendVerificationOtp(user, otp);
  }

  async sendPasswordResetEmail(user: IUser, otp: string): Promise<void> {
    return this.sendPasswordResetOtp(user, otp);
  }
}

export const emailService = new EmailService();
