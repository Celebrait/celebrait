// Temporary file to provide missing email functions until they can be properly integrated

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    name: string;
    content: string;
    type: string;
  }>;
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

// Enhanced business order processing email with comprehensive supplier information
export function generateBusinessOrderEmail(orderData: any, customerInfo: any, shippingAddress?: any, zipFileName?: string): EmailParams {
  const isTestOrder = orderData.amount === 500; // R5.00 test orders
  
  return {
    to: 'aidanchant26@gmail.com', // Your business email
    from: 'system@celebrait.co.za',
    subject: `${isTestOrder ? '[TEST] ' : ''}NEW PRINT ORDER #${orderData.cardId} - ${orderData.customerName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 750px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <!-- Header -->
        <div style="background: ${isTestOrder ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)'}; color: white; padding: 25px; border-radius: 12px 12px 0 0; text-align: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">${isTestOrder ? '🧪 TEST PRINT ORDER' : '📦 NEW PRINT ORDER'}</h1>
          <p style="margin: 8px 0 0; font-size: 18px; opacity: 0.95;">ORDER #${orderData.cardId}</p>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">R${(orderData.amount / 100).toFixed(2)} • ${new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</p>
        </div>
        
        <div style="background: white; border: 1px solid #e5e7eb; padding: 30px; border-top: 0; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Customer Details -->
          <div style="background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%); padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #1e40af; margin: 0 0 15px; font-size: 18px; font-weight: 600;">👤 Customer Information</h2>
            <div style="display: grid; gap: 8px;">
              <p style="margin: 0; font-size: 16px;"><strong>Name:</strong> <span style="color: #1f2937;">${orderData.customerName}</span></p>
              <p style="margin: 0; font-size: 16px;"><strong>Email:</strong> <span style="color: #1f2937;">${orderData.customerEmail}</span></p>
              ${orderData.customerPhone ? `<p style="margin: 0; font-size: 16px;"><strong>Phone:</strong> <span style="color: #1f2937;">${orderData.customerPhone}</span></p>` : ''}
              <p style="margin: 0; font-size: 16px;"><strong>Order ID:</strong> <span style="color: #1f2937;">${orderData.cardId}</span></p>
            </div>
          </div>
          
          ${shippingAddress ? `
          <!-- Delivery Address -->
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #92400e; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📍 Delivery Address</h3>
            <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0 0 5px; font-size: 16px; font-weight: 600; color: #1f2937;">${orderData.customerName}</p>
              <p style="margin: 0 0 3px; color: #4b5563;">${shippingAddress.line1}</p>
              ${shippingAddress.line2 ? `<p style="margin: 0 0 3px; color: #4b5563;">${shippingAddress.line2}</p>` : ''}
              <p style="margin: 0 0 3px; color: #4b5563;">${shippingAddress.city}, ${shippingAddress.province}</p>
              <p style="margin: 0 0 10px; color: #4b5563; font-weight: 600;">${shippingAddress.postalCode}</p>
              ${shippingAddress.notes ? `<p style="margin: 10px 0 0; padding: 10px; background: #fef3c7; border-radius: 4px; font-style: italic; color: #92400e;"><strong>Special Instructions:</strong> ${shippingAddress.notes}</p>` : ''}
            </div>
          </div>
          ` : ''}
          
          <!-- Print Specifications -->
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #166534; margin: 0 0 15px; font-size: 18px; font-weight: 600;">🖨️ Print Specifications</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #22c55e;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; font-weight: 600;">CARD SIZE</p>
                <p style="margin: 3px 0 0; font-size: 16px; color: #1f2937; font-weight: 700;">5" × 5" (127mm × 127mm)</p>
              </div>
              <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #22c55e;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; font-weight: 600;">RESOLUTION</p>
                <p style="margin: 3px 0 0; font-size: 16px; color: #1f2937; font-weight: 700;">300 DPI</p>
              </div>
              <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #22c55e;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; font-weight: 600;">PAPER</p>
                <p style="margin: 3px 0 0; font-size: 16px; color: #1f2937; font-weight: 700;">350gsm Premium Cardstock</p>
              </div>
              <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #22c55e;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; font-weight: 600;">FINISH</p>
                <p style="margin: 3px 0 0; font-size: 16px; color: #1f2937; font-weight: 700;">Matte/Satin Preferred</p>
              </div>
            </div>
          </div>
          
          <!-- File Attachment Info -->
          <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #a855f7;">
            <h3 style="color: #7c2d12; margin: 0 0 15px; font-size: 18px; font-weight: 600;">📎 Print Files Package</h3>
            ${zipFileName ? `
            <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
              <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #1f2937;">📦 ${zipFileName}</p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Contains: Front PDF + Inside PDF + Print Specifications</p>
            </div>
            ` : ''}
            <div style="background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">📋 PRINTING INSTRUCTIONS:</p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #92400e; font-size: 14px;">
                <li>Print FRONT and INSIDE on separate sheets</li>
                <li>Use premium 350gsm cardstock</li>
                <li>Ensure color calibration for accurate colors</li>
                <li>Fold carefully along center line</li>
                <li>Quality check before shipping</li>
              </ul>
            </div>
          </div>
          
          <!-- Order Summary -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 16px; font-weight: 600;">💰 Order Summary</h3>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280;">Payment Reference:</span>
              <span style="color: #1f2937; font-weight: 600;">#${orderData.paymentReference}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280;">Payment Status:</span>
              <span style="color: #059669; font-weight: 600;">✅ Confirmed</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 12px;">
              <span style="color: #1f2937; font-weight: 600;">Total Amount:</span>
              <span style="color: #1f2937; font-size: 18px; font-weight: 700;">R${(orderData.amount / 100).toFixed(2)}</span>
            </div>
          </div>
          
          ${isTestOrder ? `
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: center;">
            <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 700;">⚠️ TEST ORDER - R5.00</p>
            <p style="margin: 8px 0 0; color: #92400e; font-size: 14px;">This is a test transaction. Handle according to testing protocols.</p>
          </div>
          ` : ''}
        </div>
      </div>
    `,
    text: `NEW PRINT ORDER #${orderData.cardId} - ${orderData.customerName}
    
CUSTOMER DETAILS:
Name: ${orderData.customerName}
Email: ${orderData.customerEmail}
${orderData.customerPhone ? `Phone: ${orderData.customerPhone}` : ''}
Order ID: ${orderData.cardId}

${shippingAddress ? `DELIVERY ADDRESS:
${orderData.customerName}
${shippingAddress.line1}
${shippingAddress.line2 || ''}
${shippingAddress.city}, ${shippingAddress.province} ${shippingAddress.postalCode}
${shippingAddress.notes ? `Special Instructions: ${shippingAddress.notes}` : ''}` : ''}

PRINT SPECIFICATIONS:
- Size: 5" × 5" (127mm × 127mm)
- Resolution: 300 DPI
- Paper: 350gsm Premium Cardstock
- Finish: Matte/Satin Preferred

PAYMENT DETAILS:
Reference: #${orderData.paymentReference}
Amount: R${(orderData.amount / 100).toFixed(2)}
Status: ✅ Confirmed

${zipFileName ? `ATTACHED FILES: ${zipFileName}` : 'Print files attached as ZIP package.'}

INSTRUCTIONS:
1. Print FRONT and INSIDE on separate sheets
2. Use premium 350gsm cardstock
3. Ensure accurate color reproduction
4. Fold carefully and quality check
5. Ship to customer address above

${isTestOrder ? '\n⚠️ TEST ORDER (R5.00) - Handle according to testing protocols.' : ''}`
  };
}