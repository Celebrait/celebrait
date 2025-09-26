// Temporary file to provide missing email functions until they can be properly integrated

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export function generateOrderConfirmationEmail(orderData: any, cardId?: number, host?: string): EmailParams {
  const baseUrl = host ? `https://${host}` : '';
  
  return {
    to: orderData.customerEmail,
    from: 'orders@celebrait.co.za',
    subject: 'Order Confirmation - Your Celebrait Card',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Thank You! 🎉</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Your order has been confirmed</p>
        </div>
        
        <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; border-top: 0;">
          <p style="font-size: 18px; margin: 0 0 20px;"><strong>Dear ${orderData.customerName},</strong></p>
          
          <p style="color: #4b5563; line-height: 1.6;">Your payment has been confirmed and your personalized greeting card is being printed and prepared for shipping.</p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px; color: #1f2937;">Order Details</h3>
            <p style="margin: 5px 0;"><strong>Payment Reference:</strong> ${orderData.paymentReference}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> R${(orderData.amount / 100).toFixed(2)}</p>
            ${cardId ? `<p style="margin: 5px 0;"><strong>Card ID:</strong> ${cardId}</p>` : ''}
          </div>
          
          ${cardId && host ? `
          <div style="background: linear-gradient(135deg, #f0f4ff 0%, #fef7ff 100%); padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <h3 style="margin: 0 0 15px; color: #7c3aed;">📱 Save to Your Phone (Free Digital Copy)</h3>
            <p style="color: #4b5563; margin: 0 0 20px;">As a bonus, save high-quality images of your card to share digitally!</p>
            
            <div style="margin: 20px 0;">
              <a href="${baseUrl}/api/cards/${cardId}/download-image/front" 
                 style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 5px;">
                📲 Save Front Image
              </a>
              <a href="${baseUrl}/api/cards/${cardId}/download-image/inside" 
                 style="display: inline-block; background: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 5px;">
                📲 Save Inside Image
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin: 15px 0 0;">Tap the buttons above to download high-quality images perfect for sharing on social media!</p>
          </div>
          ` : ''}
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="color: #4b5563; line-height: 1.6;">Your printed card will be carefully packaged and shipped within 2-3 business days. You'll receive a shipping notification with tracking details.</p>
            <p style="color: #4b5563; line-height: 1.6; margin-top: 15px;"><strong>Questions?</strong> Reply to this email or contact us at support@celebrait.co.za</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #9ca3af; font-size: 14px;">Thank you for choosing Celebrait! 💜</p>
          </div>
        </div>
      </div>
    `,
    text: `Thank you for your order! Payment Reference: ${orderData.paymentReference}, Amount: R${(orderData.amount / 100).toFixed(2)}. Your card is being printed and will ship within 2-3 business days.`
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

// Business order processing email with PDF attachments
export function generateBusinessOrderEmail(orderData: any, customerInfo: any, shippingAddress?: any): EmailParams {
  const isTestOrder = orderData.amount === 500; // R5.00 test orders
  
  return {
    to: 'orders@celebrait.co.za', // Your business email
    from: 'system@celebrait.co.za',
    subject: `${isTestOrder ? '[TEST] ' : ''}New Order #${orderData.paymentReference} - R${(orderData.amount / 100).toFixed(2)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: ${isTestOrder ? '#f59e0b' : '#059669'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">${isTestOrder ? '🧪 TEST ORDER' : '📦 NEW ORDER'} #${orderData.paymentReference}</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Amount: R${(orderData.amount / 100).toFixed(2)} • ${new Date().toLocaleString('en-ZA')}</p>
        </div>
        
        <div style="background: white; border: 1px solid #e5e7eb; padding: 25px; border-top: 0;">
          <h2 style="color: #1f2937; margin: 0 0 20px;">Customer Information</h2>
          <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
            <p style="margin: 5px 0;"><strong>Name:</strong> ${orderData.customerName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${orderData.customerEmail}</p>
            ${orderData.customerPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${orderData.customerPhone}</p>` : ''}
          </div>
          
          ${shippingAddress ? `
          <h3 style="color: #1f2937; margin: 20px 0 10px;">Shipping Address</h3>
          <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
            <p style="margin: 5px 0;">${shippingAddress.street}</p>
            ${shippingAddress.apartment ? `<p style="margin: 5px 0;">${shippingAddress.apartment}</p>` : ''}
            <p style="margin: 5px 0;">${shippingAddress.city}, ${shippingAddress.province} ${shippingAddress.postalCode}</p>
            <p style="margin: 5px 0;">${shippingAddress.country}</p>
            ${shippingAddress.notes ? `<p style="margin: 15px 0 5px; font-style: italic;"><strong>Delivery Notes:</strong> ${shippingAddress.notes}</p>` : ''}
          </div>
          ` : ''}
          
          <h3 style="color: #1f2937; margin: 20px 0 10px;">Order Details</h3>
          <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
            <p style="margin: 5px 0;"><strong>Card ID:</strong> ${orderData.cardId}</p>
            <p style="margin: 5px 0;"><strong>Payment Reference:</strong> ${orderData.paymentReference}</p>
            <p style="margin: 5px 0;"><strong>Order Type:</strong> Printed Card (5" x 5")</p>
            <p style="margin: 5px 0;"><strong>Payment Status:</strong> ✅ Confirmed</p>
            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> R${(orderData.amount / 100).toFixed(2)}</p>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px;">
            <h4 style="margin: 0 0 10px; color: #92400e;">📎 Print Files</h4>
            <p style="margin: 0; color: #92400e;">High-resolution PDF files are attached to this email for printing.</p>
            <p style="margin: 10px 0 0; font-size: 14px; color: #92400e;"><strong>Specs:</strong> 5" x 5" • 300 DPI • CMYK • Premium cardstock recommended</p>
          </div>
          
          ${isTestOrder ? `
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin-top: 15px;">
            <p style="margin: 0; color: #92400e;"><strong>⚠️ This is a test order (R5.00)</strong> - Handle accordingly.</p>
          </div>
          ` : ''}
        </div>
      </div>
    `,
    text: `New Order #${orderData.paymentReference} - R${(orderData.amount / 100).toFixed(2)}
    
Customer: ${orderData.customerName} (${orderData.customerEmail})
Card ID: ${orderData.cardId}
Payment: ✅ Confirmed

${shippingAddress ? `Shipping Address: ${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.province} ${shippingAddress.postalCode}` : ''}

Print files attached. Specs: 5" x 5", 300 DPI, CMYK.`
  };
}