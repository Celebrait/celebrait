// Temporary file to provide missing email functions until they can be properly integrated

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export function generateOrderConfirmationEmail(orderData: any): EmailParams {
  return {
    to: orderData.customerEmail,
    from: 'orders@celebrait.co.za',
    subject: 'Order Confirmation - Your Celebrait Card',
    html: `
      <h2>Thank you for your order!</h2>
      <p>Dear ${orderData.customerName},</p>
      <p>Your payment has been confirmed and your order is being processed.</p>
      <p><strong>Order Details:</strong></p>
      <ul>
        <li>Payment Reference: ${orderData.paymentReference}</li>
        <li>Amount: ${orderData.currency || 'ZAR'} ${(orderData.amount / 100).toFixed(2)}</li>
      </ul>
      <p>You will receive your card shortly. Thank you for choosing Celebrait!</p>
    `,
    text: `Thank you for your order! Payment Reference: ${orderData.paymentReference}, Amount: ${orderData.currency || 'ZAR'} ${(orderData.amount / 100).toFixed(2)}`
  };
}

export function generateDigitalCardEmail(orderData: any, cardUrl: string, host?: string): EmailParams {
  const card = orderData.card || {};
  return {
    to: orderData.customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Digital Celebrait Card is Ready! 🎉',
    html: `
      <h2>Your Digital Card is Ready!</h2>
      <p>Dear ${orderData.customerName},</p>
      <p>Your personalized greeting card has been created and is ready to view!</p>
      <p><a href="${cardUrl}" style="background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">View Your Card</a></p>
      <p>You can also download PDF versions from your order confirmation page.</p>
      <p>Thank you for using Celebrait!</p>
    `,
    text: `Your digital card is ready! View it at: ${cardUrl}`
  };
}

export function generateDigitalCardEmailForRecipient(orderData: any, recipientName: string, recipientEmail: string, senderName: string, cardUrl: string, host?: string): EmailParams {
  return {
    to: recipientEmail,
    from: 'greetings@celebrait.co.za',
    subject: `You have a special greeting card from ${senderName}! 🎉`,
    html: `
      <h2>You have a special greeting card!</h2>
      <p>Dear ${recipientName},</p>
      <p>${senderName} has sent you a personalized greeting card created with Celebrait!</p>
      <p><a href="${cardUrl}" style="background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">View Your Card</a></p>
      <p>This card was made especially for you.</p>
      <p>With love from the Celebrait team 💜</p>
    `,
    text: `${senderName} has sent you a special greeting card! View it at: ${cardUrl}`
  };
}

export function generateAbandonmentRecoveryEmail(card: any, userEmail: string, userName: string, recoveryUrl: string): EmailParams {
  return {
    to: userEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Celebrait Card is Waiting for You! 🎨',
    html: `
      <h2>Don't forget your card!</h2>
      <p>Dear ${userName},</p>
      <p>You started creating a beautiful greeting card but didn't finish your order.</p>
      <p>Your card is still saved and ready to complete!</p>
      <p><a href="${recoveryUrl}" style="background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Complete Your Order</a></p>
      <p>Thank you for choosing Celebrait!</p>
    `,
    text: `Complete your greeting card order at: ${recoveryUrl}`
  };
}

export function generateShippingNotificationEmail(orderData: any): EmailParams {
  return {
    to: orderData.customerEmail,
    from: 'shipping@celebrait.co.za',
    subject: 'Your Celebrait Card Has Shipped! 📦',
    html: `
      <h2>Your card is on its way!</h2>
      <p>Dear ${orderData.customerName},</p>
      <p>Great news! Your personalized greeting card has been printed and shipped.</p>
      ${orderData.trackingNumber ? `<p><strong>Tracking Number:</strong> ${orderData.trackingNumber}</p>` : ''}
      <p>You should receive it within 3-5 business days.</p>
      <p>Thank you for choosing Celebrait!</p>
    `,
    text: `Your card has shipped! ${orderData.trackingNumber ? `Tracking: ${orderData.trackingNumber}` : ''}`
  };
}