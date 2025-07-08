import sgMail from '@sendgrid/mail';
import { storage } from './storage';

const sendgridApiKey = process.env.SENDGRID_API_KEY;

if (!sendgridApiKey) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

console.log('SendGrid API Key configured:', sendgridApiKey ? 'Present' : 'Missing');
console.log('SendGrid API Key length:', sendgridApiKey?.length || 0);

sgMail.setApiKey(sendgridApiKey);

function hasValidSendGridConfig(): boolean {
  return !!(sendgridApiKey && sendgridApiKey.length > 0);
}

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
      text: params.text || 'Email content is available in HTML format.',
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

export function generateDigitalCardEmail(orderData: any, cardImageUrl: string, host?: string): EmailParams {
  const { customerEmail, customerName, paymentReference } = orderData;

  // Use proper domain detection - if host contains localhost or undefined, use Replit domain
  const actualHost = (!host || host.includes('localhost')) ? 
    '71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev' : 
    host;

  return {
    to: customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Digital Celebrait Card is Ready! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; }
          .card-image { max-width: 250px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 15px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Card is Ready!</h1>
          </div>
          <div class="content">
            <p>Hi ${customerName}!</p>
            <p>Your digital greeting card is ready to view and share:</p>
            
            <img src="${cardImageUrl}" alt="Your custom card" class="card-image" />
            
            <div>
              <a href="https://${actualHost}/card/${paymentReference}" class="button">View Digital Card</a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 15px;">
              Share this link: https://${actualHost}/card/${paymentReference}
            </p>
          </div>
          
          <div class="footer">
            <p>© 2025 Celebrait. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Your Digital Celebrait Card is Ready! 🎉

Hi ${customerName}!

Your digital greeting card is ready to view and share.

View your card: https://${actualHost}/card/${paymentReference}

Thank you for choosing Celebrait!
    `
  };
}

export function generateCardReadyNotificationEmail(orderData: any, host?: string): EmailParams {
  const { customerEmail, customerName, paymentReference, cardType } = orderData;

  // Send users to card preview first, then they'll proceed to delivery details
  const nextStepUrl = `https://${host || 'localhost:5000'}/card-preview/${paymentReference}`;
  const nextStepText = 'View Your Card';
    
  const descriptionText = 'Your personalized greeting card has been generated and is ready to view! Click the button below to see your creation.';

  return {
    to: customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Celebrait Card is Ready to View! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button-section { text-align: center; margin: 30px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Card is Ready!</h1>
            <p>Time to view your personalized Celebrait card!</p>
          </div>
          <div class="content">
            <h2>Hi ${customerName}!</h2>
            <p>${descriptionText}</p>

            <div class="button-section">
              <a href="${nextStepUrl}" class="button">${nextStepText}</a>
              <p style="margin-top: 15px; color: #666; font-size: 14px;">
                Or copy this link: ${nextStepUrl}
              </p>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for choosing Celebrait!</p>
            <p style="font-size: 12px; color: #999;">
              © 2025 Celebrait. All rights reserved.
            </p>
          </div>
        </div>
    `,
    text: `
Your Celebrait Card is Ready to View!

Hi ${customerName}!

${descriptionText}

${nextStepText}: ${nextStepUrl}

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

export async function sendCardReadyEmail(email: string, cardId: number) {
  console.log('Attempting to send card ready email to:', email, 'for card:', cardId);

  if (!hasValidSendGridConfig()) {
    console.log('SendGrid not configured, skipping email send');
    return false;
  }

  try {
    // Get card from storage to verify it exists and is ready
    const card = await storage.getCard(cardId);
    if (!card) {
      console.error('Card not found for email notification:', cardId);
      return false;
    }

    console.log('Card status for email notification:', card.status);
    if (card.status !== 'completed') {
      console.error('Card not completed, status:', card.status, 'for card:', cardId);
      return false;
    }

    console.log('Sending email with card data:', {
      cardId,
      frontImageUrl: card.frontImageUrl ? 'present' : 'missing',
      insideImageUrl: card.insideImageUrl ? 'present' : 'missing'
    });

    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@celebrait.co.za',
        name: 'Celebrait'
      },
      subject: '🎉 Your Celebrait card is ready!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #4F46E5; text-align: center; margin-bottom: 30px;">Your card is ready! 🎉</h1>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Great news! Your personalized greeting card has been generated and is ready for you to view and complete your order.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/complete-order?cardId=${cardId}" 
                 style="background-color: #4F46E5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                View Your Card & Complete Order
              </a>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center;">
              This link will take you to preview your card and choose your delivery method.
            </p>
            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
              Card ID: ${cardId} | Generated: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `
    };

    const response = await sgMail.send(msg);
    console.log('Card ready email sent successfully to:', email, 'Response status:', response[0].statusCode);
    return true;
  } catch (error: any) {
    console.error('Failed to send card ready email:', error);
    if (error.response) {
      console.error('SendGrid error response:', error.response.body);
    }
    return false;
  }
}