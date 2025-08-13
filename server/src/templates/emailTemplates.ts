// src/templates/emailTemplates.ts - Professional Email Templates
export const emailTemplates = {
  orderConfirmed: {
    subject: '🎉 Order Confirmed - {{orderNumber}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Order Confirmed!</h1>
            <p style="color: white; margin: 15px 0 0; font-size: 16px;">Thank you for your purchase, {{customerName}}!</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px; background: #ffffff;">
            <h2 style="color: #333; margin-bottom: 20px;">Order Details</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Order Number:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">{{orderNumber}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Order Date:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">{{orderDate}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555; border-top: 1px solid #eee; font-size: 18px;">Total Amount:</td>
                  <td style="padding: 8px 0; text-align: right; color: #28a745; font-weight: bold; border-top: 1px solid #eee; font-size: 18px;">₹{{total}}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #e3f2fd; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196f3;">
              <h3 style="margin: 0 0 15px; color: #1976d2;">What's Next?</h3>
              <div style="color: #555; line-height: 1.6;">
                <p style="margin: 8px 0;">✅ <strong>Payment confirmed</strong> - Your payment has been successfully processed</p>
                <p style="margin: 8px 0;">📦 <strong>Order is being processed</strong> - We're preparing your items</p>
                <p style="margin: 8px 0;">🚚 <strong>Shipping notification</strong> - We'll notify you when it ships</p>
              </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin-top: 35px;">
              <a href="{{trackingUrl}}" style="display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Track Your Order</a>
            </div>
            
            <!-- Support Info -->
            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee; text-align: center; color: #666;">
              <p>Need help? Contact our support team anytime.</p>
              <p style="margin: 5px 0;">📧 support@yourstore.com | 📞 +91 12345 67890</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #333; color: white; padding: 20px 30px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">© 2025 Your Store Name. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Order Confirmed - {{orderNumber}}

Hi {{customerName}},

Thank you for your purchase! Your order has been confirmed.

Order Details:
- Order Number: {{orderNumber}}  
- Order Date: {{orderDate}}
- Total: ₹{{total}}

What's next:
✅ Payment confirmed
📦 Order is being processed  
🚚 We'll notify you when it ships

Track your order: {{trackingUrl}}

Need help? Contact support@yourstore.com

Thank you for shopping with us!`
  },

  orderShipped: {
    subject: '📦 Your Order is Shipped - {{orderNumber}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Shipped</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📦 Order Shipped!</h1>
            <p style="color: white; margin: 15px 0 0; font-size: 16px;">Your order is on its way, {{customerName}}!</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px; background: #ffffff;">
            <h2 style="color: #333; margin-bottom: 20px;">Shipping Details</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Order Number:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">{{orderNumber}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Tracking Number:</td>
                  <td style="padding: 8px 0; text-align: right; color: #007bff; font-family: monospace;">{{trackingNumber}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Estimated Delivery:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">{{estimatedDelivery}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Shipping Carrier:</td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">{{carrierName}}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #e8f5e8; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #28a745;">
              <h3 style="margin: 0 0 15px; color: #155724;">📋 Delivery Information</h3>
              <div style="color: #155724; line-height: 1.6;">
                <p style="margin: 8px 0;">🚚 Your package is now in transit</p>
                <p style="margin: 8px 0;">📍 Track real-time location updates</p>
                <p style="margin: 8px 0;">📞 Delivery partner will call before delivery</p>
              </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin-top: 35px;">
              <a href="{{trackingUrl}}" style="display: inline-block; background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; margin-right: 10px;">Track Your Package</a>
            </div>
            
            <!-- Support Info -->
            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee; text-align: center; color: #666;">
              <p>Questions about your delivery? We're here to help!</p>
              <p style="margin: 5px 0;">📧 support@yourstore.com | 📞 +91 12345 67890</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #333; color: white; padding: 20px 30px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">© 2025 Your Store Name. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Order Shipped - {{orderNumber}}

Hi {{customerName}},

Great news! Your order has been shipped.

Shipping Details:
- Order Number: {{orderNumber}}
- Tracking Number: {{trackingNumber}}
- Estimated Delivery: {{estimatedDelivery}}
- Carrier: {{carrierName}}

Track your package: {{trackingUrl}}

Questions? Contact support@yourstore.com

Thank you!`
  },

  orderDelivered: {
    subject: '🎉 Order Delivered - {{orderNumber}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Delivered</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ffc107 0%, #ff8c00 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Order Delivered!</h1>
            <p style="color: white; margin: 15px 0 0; font-size: 16px;">Hope you love your purchase, {{customerName}}!</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px; background: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #333; margin-bottom: 15px;">Your Order Has Been Delivered Successfully!</h2>
              <p style="color: #666; font-size: 16px;">Order <strong>{{orderNumber}}</strong> was delivered on {{orderDate}}</p>
            </div>
            
            <div style="background: #fff3cd; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
              <h3 style="margin: 0 0 15px; color: #856404;">📋 What's Next?</h3>
              <div style="color: #856404; line-height: 1.6;">
                <p style="margin: 8px 0;">✅ Enjoy your new purchase!</p>
                <p style="margin: 8px 0;">⭐ Share your experience with a review</p>
                <p style="margin: 8px 0;">🔄 Need something similar? Reorder with one click</p>
              </div>
            </div>
            
            <!-- CTA Buttons -->
            <div style="text-align: center; margin-top: 35px;">
              <a href="{{reviewUrl}}" style="display: inline-block; background: #28a745; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; margin: 0 10px 10px;">⭐ Leave a Review</a>
              <a href="{{reorderUrl}}" style="display: inline-block; background: #007bff; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; margin: 0 10px 10px;">🔄 Reorder</a>
            </div>
            
            <!-- Support Info -->
            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee; text-align: center; color: #666;">
              <p>Need help with your order? We're always here for you!</p>
              <p style="margin: 5px 0;">📧 support@yourstore.com | 📞 +91 12345 67890</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #333; color: white; padding: 20px 30px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">© 2025 Your Store Name. All rights reserved.</p>
            <p style="margin: 10px 0 0; font-size: 12px;">Thank you for choosing us for your shopping needs!</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Order Delivered - {{orderNumber}}

Hi {{customerName}},

Great news! Your order {{orderNumber}} has been delivered successfully.

What's next:
✅ Enjoy your purchase!
⭐ Leave a review: {{reviewUrl}}
🔄 Reorder: {{reorderUrl}}

Need help? Contact support@yourstore.com

Thank you for shopping with us!`
  }
};
