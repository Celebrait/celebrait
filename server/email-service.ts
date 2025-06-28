import sgMail from '@sendgrid/mail';

const sendgridApiKey = process.env.SENDGRID_API_KEY;

if (!sendgridApiKey) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

console.log('SendGrid API Key configured:', sendgridApiKey ? 'Present' : 'Missing');
console.log('SendGrid API Key length:', sendgridApiKey?.length || 0);

sgMail.setApiKey(sendgridApiKey);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    console.log(`Attempting to send email to: ${params.to}`);
    console.log(`From: ${params.from}`);
    console.log(`Subject: ${params.subject}`);
    
    const result = await sgMail.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      ...(params.text && { text: params.text }),
      ...(params.html && { html: params.html }),
    });
    
    console.log('SendGrid response status:', result[0]?.statusCode);
    console.log('SendGrid response headers:', result[0]?.headers);
    
    // Check for X-Message-Id header which tracks the message
    if (result[0]?.headers && result[0].headers['x-message-id']) {
      console.log('SendGrid Message ID:', result[0].headers['x-message-id']);
    }
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    
    // Log specific error details for troubleshooting
    if (error.response && error.response.body) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2));
      
      // Check for specific error types
      if (error.response.body.errors) {
        error.response.body.errors.forEach((err: any) => {
          console.error('SendGrid error:', err.message);
          if (err.field) {
            console.error('Field:', err.field);
          }
        });
      }
    }
    
    return false;
  }
}

// Email templates
export function generateOrderConfirmationEmail(orderData: any): EmailParams {
  const { customerEmail, customerName, paymentReference, amount, currency } = orderData;
  
  return {
    to: customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Order Confirmation - Your Celebrait Card',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          /* CUSTOMIZABLE: Change these values to match your brand */
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          
          /* BRAND COLORS: Update gradient and button colors here */
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          
          /* LAYOUT: Adjust spacing and backgrounds */
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Order Confirmed!</h1>
            <p>Thank you for choosing Celebrait</p>
          </div>
          <div class="content">
            <h2>Hi ${customerName}!</h2>
            <p>We're excited to confirm that your custom greeting card order has been received and is being processed.</p>
            
            <div class="order-details">
              <h3>Order Details</h3>
              <p><strong>Reference:</strong> ${paymentReference}</p>
              <p><strong>Amount:</strong> ${currency} ${(amount / 100).toFixed(2)}</p>
              <p><strong>Status:</strong> Processing</p>
            </div>
            
            <p>Your personalized greeting card is being carefully prepared. For printed cards, you can expect delivery within 5-7 business days.</p>
            
            <p>We'll send you another email once your order ships with tracking information.</p>
            
            <a href="https://celebrait.com/order-status?ref=${paymentReference}" class="button">Track Your Order</a>
          </div>
          <div class="footer">
            <p>Questions? Contact us at support@celebrait.com</p>
            <p>© 2025 Celebrait. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Order Confirmation - Celebrait

Hi ${customerName}!

Your custom greeting card order has been confirmed.

Order Details:
- Reference: ${paymentReference}
- Amount: ${currency} ${(amount / 100).toFixed(2)}
- Status: Processing

Your personalized greeting card is being prepared. For printed cards, expect delivery within 5-7 business days.

We'll send tracking information once your order ships.

Questions? Contact us at support@celebrait.com

© 2025 Celebrait. All rights reserved.
    `
  };
}

export function generateDigitalCardEmail(orderData: any, cardImageUrl: string): EmailParams {
  const { customerEmail, customerName, paymentReference } = orderData;
  
  return {
    to: customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Digital Celebrait Card is Ready! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .card-preview { text-align: center; margin: 30px 0; }
          .card-image { max-width: 300px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
          .download-section { background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Card is Ready!</h1>
            <p>Beautiful, personalized, and ready to share</p>
          </div>
          <div class="content">
            <h2>Hi ${customerName}!</h2>
            <p>Your custom digital greeting card has been created and is ready for download!</p>
            
            <div class="card-preview">
              <img src="${cardImageUrl}" alt="Your Custom Card" class="card-image" />
            </div>
            
            <div class="download-section">
              <h3>Ready to Share</h3>
              <p>Your high-quality digital card is ready to view and share with your loved ones.</p>
              <a href="${process.env.REPLIT_DOMAIN || 'https://celebrait.replit.app'}/card/${paymentReference}" class="button">View Interactive Card</a>
              ${cardImageUrl ? `<a href="${cardImageUrl}" class="button" download>Download Image</a>` : ''}
            </div>
            
            <p>Share this special moment with someone you care about. Your personalized card was created with love using AI technology.</p>
            
            <p>Thank you for choosing Celebrait to help you celebrate life's special moments!</p>
          </div>
          <div class="footer">
            <p>Love your card? Share your experience with friends!</p>
            <p>© 2025 Celebrait. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Your Digital Celebrait Card is Ready!

Hi ${customerName}!

Your custom digital greeting card has been created and is ready for download!

Download your card: ${cardImageUrl}

Share this special moment with someone you care about. Your personalized card was created with love using AI technology.

Thank you for choosing Celebrait!

© 2025 Celebrait. All rights reserved.
    `
  };
}

export function generateShippingNotificationEmail(orderData: any, trackingNumber: string): EmailParams {
  const { customerEmail, customerName, paymentReference } = orderData;
  
  return {
    to: customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Celebrait Card Has Shipped! 📦',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .shipping-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Your Card Has Shipped!</h1>
            <p>On its way to spread joy</p>
          </div>
          <div class="content">
            <h2>Hi ${customerName}!</h2>
            <p>Great news! Your custom Celebrait card has been carefully packed and shipped.</p>
            
            <div class="shipping-details">
              <h3>Shipping Information</h3>
              <p><strong>Order Reference:</strong> ${paymentReference}</p>
              <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
              <p><strong>Expected Delivery:</strong> 3-5 business days</p>
            </div>
            
            <p>You can track your package using the tracking number above. Your beautifully crafted card will arrive soon!</p>
            
            <a href="https://tracking-link.com/${trackingNumber}" class="button">Track Your Package</a>
            
            <p>We can't wait for you to see your personalized creation. Thank you for trusting Celebrait with your special moments!</p>
          </div>
          <div class="footer">
            <p>Questions about your order? Contact us at support@celebrait.com</p>
            <p>© 2025 Celebrait. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Your Celebrait Card Has Shipped!

Hi ${customerName}!

Your custom card has been shipped and is on its way!

Shipping Information:
- Order Reference: ${paymentReference}
- Tracking Number: ${trackingNumber}
- Expected Delivery: 3-5 business days

Track your package: https://tracking-link.com/${trackingNumber}

Questions? Contact us at support@celebrait.com

© 2025 Celebrait. All rights reserved.
    `
  };
}