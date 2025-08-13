// src/config/emailService.ts - FIXED VERSION
import nodemailer from 'nodemailer';
import { IOrder } from '../types';

interface EmailTemplate {
  subject: string;
  html: string;
}

interface SMSConfig {
  apiKey: string;
  senderId: string;
  endpoint: string;
}

class EmailAutomationService {
  private transporter: nodemailer.Transporter;
  private smsConfig: SMSConfig;
  private adminEmails: string[];

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.smsConfig = {
      apiKey: process.env.SMS_API_KEY || '',
      senderId: process.env.SMS_SENDER_ID || 'NAKODA',
      endpoint: process.env.SMS_ENDPOINT || 'https://api.textlocal.in/send/'
    };

    this.adminEmails = process.env.AUTHORIZED_ADMIN_EMAILS?.split(',').map(email => email.trim()) || ['admin@nakodamobile.com'];
    this.testConnection();
  }

  private async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connected successfully');
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
    }
  }

  async sendOrderConfirmation(order: IOrder, customerEmail: string): Promise<boolean> {
    const template = this.getOrderConfirmationTemplate(order);
    
    try {
      console.log('📧 Sending order confirmation email to:', customerEmail);
      
      await this.transporter.sendMail({
        from: `"${process.env.COMPANY_NAME || 'Nakoda Mobile'}" <${process.env.SMTP_USER}>`,
        to: customerEmail,
        subject: template.subject,
        html: template.html,
      });

      await this.sendSMS(
        order.shippingAddress.phoneNumber,
        `🎉 Order confirmed! Order #${order.orderNumber} for ₹${(order.total ?? 0).toFixed(2)}. Track: nakodamobile.com/track/${order._id}`
      );

      console.log('✅ Order confirmation sent:', order.orderNumber);
      return true;
    } catch (error) {
      console.error('❌ Email/SMS failed:', error);
      return false;
    }
  }

  async notifyAdminNewOrder(order: IOrder): Promise<boolean> {
    const template = this.getAdminOrderNotificationTemplate(order);

    try {
      console.log('📧 Sending admin notifications to:', this.adminEmails);
      
      await Promise.all(this.adminEmails.map(email => 
        this.transporter.sendMail({
          from: `"${process.env.COMPANY_NAME || 'Nakoda Mobile'} System" <${process.env.SMTP_USER}>`,
          to: email.trim(),
          subject: template.subject,
          html: template.html,
          priority: 'high'
        })
      ));

      console.log('✅ Admin notifications sent for order:', order.orderNumber);
      return true;
    } catch (error) {
      console.error('❌ Admin notification failed:', error);
      return false;
    }
  }

  async sendOrderStatusUpdate(order: IOrder, previousStatus: string): Promise<boolean> {
    const template = this.getStatusUpdateTemplate(order, previousStatus);
    
    try {
      await this.transporter.sendMail({
        from: `"${process.env.COMPANY_NAME || 'Nakoda Mobile'}" <${process.env.SMTP_USER}>`,
        to: order.shippingAddress.email,
        subject: template.subject,
        html: template.html,
      });

      if (['shipped', 'delivered', 'cancelled'].includes(order.orderStatus)) {
        const smsMessage = this.getStatusSMSMessage(order);
        await this.sendSMS(order.shippingAddress.phoneNumber, smsMessage);
      }

      console.log('✅ Status update sent:', order.orderNumber, order.orderStatus);
      return true;
    } catch (error) {
      console.error('❌ Status update failed:', error);
      return false;
    }
  }

  private async sendSMS(phoneNumber: string, message: string): Promise<void> {
    if (!this.smsConfig.apiKey) {
      console.log('⚠️ SMS API not configured, skipping SMS');
      return;
    }

    try {
      const response = await fetch(this.smsConfig.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: this.smsConfig.apiKey,
          numbers: phoneNumber.replace('+91', ''),
          message: message,
          sender: this.smsConfig.senderId
        })
      });

      if (response.ok) {
        console.log('✅ SMS sent to:', phoneNumber);
      }
    } catch (error) {
      console.error('❌ SMS failed:', error);
    }
  }

  // ✅ FIXED: Order confirmation template with null-safe total handling
  private getOrderConfirmationTemplate(order: IOrder): EmailTemplate {
    return {
      subject: `Order Confirmed - #${order.orderNumber} | ${process.env.COMPANY_NAME || 'Nakoda Mobile'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0;">🎉 Order Confirmed!</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">Thank you for choosing ${process.env.COMPANY_NAME || 'Nakoda Mobile'}</p>
            </div>
            
            <div style="padding: 30px;">
              <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h2 style="color: #27ae60; margin: 0 0 10px 0;">Order Details</h2>
                <p><strong>Order Number:</strong> #${order.orderNumber}</p>
                <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod.toUpperCase()}</p>
                <p><strong>Total Amount:</strong> ₹${(order.total ?? 0).toFixed(2)}</p>
              </div>

              <h3>📦 Items Ordered:</h3>
              <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
                ${order.items?.map(item => `
                  <div style="padding: 15px; border-bottom: 1px solid #eee;">
                    <h4 style="margin: 0 0 5px 0;">${item.name || 'Product'}</h4>
                    <p style="margin: 0; color: #666;">Quantity: ${item.quantity || 0} × ₹${(item.price ?? 0).toFixed(2)}</p>
                    <div style="font-weight: bold;">₹${((item.quantity || 0) * (item.price || 0)).toFixed(2)}</div>
                  </div>
                `).join('') || '<p>No items found</p>'}
              </div>

              <div style="background: #fff3cd; padding: 20px; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">🚚 What's Next?</h4>
                <ul style="margin: 0; padding-left: 20px; color: #856404;">
                  <li>Your order is being processed</li>
                  <li>You'll receive tracking details once shipped</li>
                  <li>Estimated delivery: 3-5 business days</li>
                </ul>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  // ✅ FIXED: Admin notification template with null-safe total handling
  private getAdminOrderNotificationTemplate(order: IOrder): EmailTemplate {
    return {
      subject: `🚨 NEW ORDER - #${order.orderNumber} - ₹${(order.total ?? 0).toFixed(2)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: white;">
            <div style="background: #dc3545; padding: 20px; text-align: center; color: white;">
              <h1>🚨 NEW ORDER RECEIVED</h1>
              <p>Order #${order.orderNumber} - ₹${(order.total ?? 0).toFixed(2)}</p>
            </div>
            <div style="padding: 30px;">
              <p><strong>Customer:</strong> ${order.shippingAddress?.fullName || 'Unknown'}</p>
              <p><strong>Email:</strong> ${order.shippingAddress?.email || 'Unknown'}</p>
              <p><strong>Phone:</strong> ${order.shippingAddress?.phoneNumber || 'Unknown'}</p>
              <p><strong>Total:</strong> ₹${(order.total ?? 0).toFixed(2)}</p>
              <p><strong>Items:</strong> ${order.items?.length || 0}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  private getStatusUpdateTemplate(order: IOrder, previousStatus: string): EmailTemplate {
    return {
      subject: `Order Update - #${order.orderNumber} | ${process.env.COMPANY_NAME || 'Nakoda Mobile'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: white;">
            <div style="background: #28a745; padding: 20px; text-align: center; color: white;">
              <h1>📦 Order Status Updated</h1>
              <p>Order #${order.orderNumber}</p>
            </div>
            <div style="padding: 30px;">
              <p>Your order status has been updated from <strong>${previousStatus}</strong> to <strong>${order.orderStatus}</strong></p>
              ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  private getStatusSMSMessage(order: IOrder): string {
    const messages: Record<string, string> = {
      shipped: `📦 Your order #${order.orderNumber} has been shipped${order.trackingNumber ? ` (Track: ${order.trackingNumber})` : ''}. Expected delivery in 2-3 days.`,
      delivered: `🎉 Your order #${order.orderNumber} has been delivered. Thank you for choosing Nakoda Mobile!`,
      cancelled: `❌ Order #${order.orderNumber} has been cancelled. Refund will be processed within 3-5 business days if applicable.`
    };
    return messages[order.orderStatus] || `Order #${order.orderNumber} status updated to ${order.orderStatus}`;
  }
}

const emailAutomationService = new EmailAutomationService();
export default emailAutomationService;
