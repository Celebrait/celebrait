import * as brevo from '@getbrevo/brevo';
import { storage } from './storage';

const brevoApiKey = process.env.BREVO_API_KEY;

if (!brevoApiKey) {
  throw new Error("BREVO_API_KEY environment variable must be set");
}

console.log('Brevo API Key configured:', brevoApiKey ? 'Present' : 'Missing');
console.log('Brevo API Key length:', brevoApiKey?.length || 0);

// Initialize Brevo API clients
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);

// Initialize Brevo Contacts API for marketing list management
const contactsApi = new brevo.ContactsApi();
contactsApi.setApiKey(brevo.ContactsApiApiKeys.apiKey, brevoApiKey);

function hasValidBrevoConfig(): boolean {
  return !!(brevoApiKey && brevoApiKey.length > 0);
}

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

// Marketing list management
export async function addToMarketingList(email: string, firstName?: string, lastName?: string, metadata?: any): Promise<string | null> {
  try {
    console.log(`Adding contact to Brevo marketing list: ${email}`);
    
    const createContact = new brevo.CreateContact();
    createContact.email = email;
    
    // Add optional attributes
    const attributes: any = {};
    if (firstName) attributes.FIRSTNAME = firstName;
    if (lastName) attributes.LASTNAME = lastName;
    if (metadata?.recipientName) attributes.RECIPIENT_NAME = metadata.recipientName;
    if (metadata?.celebrationType) attributes.CELEBRATION_TYPE = metadata.celebrationType;
    if (metadata?.signupSource) attributes.SIGNUP_SOURCE = metadata.signupSource;
    
    createContact.attributes = attributes;
    
    // Add to "Celebrait Leads" list (you'll need to create this list in Brevo)
    createContact.listIds = [1]; // Replace with your actual list ID
    
    const result = await contactsApi.createContact(createContact);
    
    console.log('Contact added to Brevo successfully:', result.body?.id);
    return result.body?.id?.toString() || null;
    
  } catch (error: any) {
    console.error('Brevo contact creation error:', error);
    
    // Handle duplicate contact gracefully
    if (error.response?.body?.code === 'duplicate_parameter') {
      console.log('Contact already exists in Brevo, updating instead');
      try {
        const updateContact = new brevo.UpdateContact();
        const attributes: any = {};
        if (firstName) attributes.FIRSTNAME = firstName;
        if (lastName) attributes.LASTNAME = lastName;
        if (metadata?.recipientName) attributes.RECIPIENT_NAME = metadata.recipientName;
        if (metadata?.celebrationType) attributes.CELEBRATION_TYPE = metadata.celebrationType;
        if (metadata?.signupSource) attributes.SIGNUP_SOURCE = metadata.signupSource;
        
        updateContact.attributes = attributes;
        updateContact.listIds = [1]; // Add to list if not already there
        
        await contactsApi.updateContact(email, updateContact);
        console.log('Contact updated in Brevo successfully');
        return 'updated';
      } catch (updateError: any) {
        console.error('Brevo contact update error:', updateError);
        return null;
      }
    }
    
    return null;
  }
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    console.log(`Attempting to send email to: ${params.to}`);
    console.log(`From: ${params.from}`);
    console.log(`Subject: ${params.subject}`);

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: params.to }];
    sendSmtpEmail.sender = { email: params.from, name: 'Celebrait' };
    sendSmtpEmail.subject = params.subject;
    sendSmtpEmail.textContent = params.text || 'Email content is available in HTML format.';
    if (params.html) {
      sendSmtpEmail.htmlContent = params.html;
    }

    // Add attachments if provided
    if (params.attachments && params.attachments.length > 0) {
      console.log('[EMAIL_SERVICE] Processing attachments...');
      console.log('[EMAIL_SERVICE] Attachments array:', params.attachments.length, 'items');
      
      sendSmtpEmail.attachment = params.attachments.map((att, index) => {
        console.log(`[EMAIL_SERVICE] Attachment ${index + 1}:`, {
          name: att.name,
          type: att.type,
          contentLength: att.content ? att.content.length : 0,
          hasContent: !!att.content
        });
        
        return {
          name: att.name,
          content: att.content,
          type: att.type
        };
      });
      console.log(`[EMAIL_SERVICE] ✅ ${params.attachments.length} attachment(s) mapped to Brevo format`);
    } else {
      console.log('[EMAIL_SERVICE] ⚠️ No attachments provided or empty attachments array');
    }

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log('Brevo response:', result.response?.statusCode);
    console.log('Brevo message ID:', result.body?.messageId);
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('Brevo email error:', error);

    // Log specific error details for troubleshooting
    if (error.response && error.response.body) {
      console.error('Brevo error details:', JSON.stringify(error.response.body, null, 2));
    }

    return false;
  }
}

// Card preview recovery email template
export function generateCardPreviewEmail(cardData: any, previewUrl: string): EmailParams {
  const { recipientName, celebrationType, customerName } = cardData;
  
  return {
    to: cardData.email,
    from: 'greetings@celebrait.co.za',
    subject: `${recipientName}'s ${celebrationType} card is ready to preview! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Celebrait Card is Ready!</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; 
            line-height: 1.6; 
            color: #1a1a1a; 
            background: #f8f9fa;
            padding: 20px 0;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(139, 92, 246, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
          }
          .logo {
            width: 80px;
            height: 80px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            font-weight: bold;
          }
          .header h1 { 
            font-size: 28px; 
            font-weight: 700; 
            margin-bottom: 8px; 
            letter-spacing: -0.5px;
          }
          .header p { 
            font-size: 16px; 
            opacity: 0.9; 
            font-weight: 400;
          }
          .content { 
            padding: 40px 30px; 
          }
          .greeting {
            font-size: 24px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 20px;
          }
          .message {
            font-size: 16px;
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.7;
          }
          .card-highlight {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border: 2px solid transparent;
            background-clip: padding-box;
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
            position: relative;
            overflow: hidden;
          }
          .card-highlight::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            margin: -2px;
            border-radius: 12px;
            z-index: -1;
          }
          .card-highlight h3 {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 12px;
          }
          .card-highlight p {
            color: #4a5568;
            margin-bottom: 20px;
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); 
            color: white; 
            padding: 16px 32px; 
            text-decoration: none; 
            border-radius: 12px; 
            font-weight: 600; 
            font-size: 16px;
            text-align: center;
            box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
          }
          .button-center {
            text-align: center;
            margin: 30px 0;
          }
          .features {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
          }
          .feature {
            text-align: center;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
          }
          .feature-icon {
            font-size: 24px;
            margin-bottom: 8px;
          }
          .feature h4 {
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 4px;
          }
          .feature p {
            font-size: 12px;
            color: #718096;
          }
          .footer { 
            background: #f8fafc;
            padding: 30px; 
            text-align: center; 
            border-top: 1px solid #e2e8f0;
          }
          .footer p {
            color: #718096;
            font-size: 14px;
            margin-bottom: 8px;
          }
          .footer .brand {
            color: #4a5568;
            font-weight: 600;
            margin-bottom: 16px;
          }
          @media (max-width: 600px) {
            .features { grid-template-columns: 1fr; }
            .content { padding: 30px 20px; }
            .header { padding: 30px 20px; }
            .greeting { font-size: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎉</div>
            <h1>Your Card is Ready!</h1>
            <p>Time to see your amazing creation</p>
          </div>
          
          <div class="content">
            <div class="greeting">Greetings, ${customerName || 'friend'}!</div>
            
            <div class="message">
              Welcome to Celebrait! We're thrilled to let you know that <strong>${recipientName}'s ${celebrationType} card</strong> has been beautifully created and is ready for you to preview.
            </div>
            
            <div class="card-highlight">
              <h3>🎨 ${recipientName}'s ${celebrationType} card</h3>
              <p>Your personalized design is waiting! Take a moment to preview your card and see how every detail came together perfectly.</p>
              
              <div class="button-center">
                <a href="${previewUrl}" class="button">Preview & Purchase Your Card</a>
              </div>
            </div>
            
            <div class="features">
              <div class="feature">
                <div class="feature-icon">👀</div>
                <h4>Preview First</h4>
                <p>See your card before ordering</p>
              </div>
              <div class="feature">
                <div class="feature-icon">💝</div>
                <h4>Choose Delivery</h4>
                <p>Digital or printed options</p>
              </div>
              <div class="feature">
                <div class="feature-icon">✨</div>
                <h4>AI-Crafted</h4>
                <p>Personalized just for ${recipientName}</p>
              </div>
              <div class="feature">
                <div class="feature-icon">🚀</div>
                <h4>Quick Order</h4>
                <p>From R129, ready in minutes</p>
              </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #f0f4ff 0%, #fef7ff 100%); padding: 20px; border-radius: 12px; margin: 30px 0; text-align: center;">
              <p style="color: #6b46c1; font-weight: 600; margin: 0;">Questions? We're here to help!</p>
              <p style="color: #7c3aed; font-size: 14px; margin: 8px 0 0;">Reply to this email or contact support@celebrait.co.za</p>
            </div>
          </div>
          
          <div class="footer">
            <p class="brand">Celebrait</p>
            <p>Creating memories, one card at a time</p>
            <p style="font-size: 12px; margin-top: 16px;">© 2025 Celebrait. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Greetings, ${customerName || 'friend'}!

Welcome to Celebrait! ${recipientName}'s ${celebrationType} card has been beautifully created and is ready for preview.

Your personalized card is waiting! Preview and purchase: ${previewUrl}

What you can do:
👀 Preview your card design
💝 Choose digital or printed delivery
🚀 Complete your order from R129
✨ Celebrate with ${recipientName}

Questions? Contact us at support@celebrait.co.za

© 2025 Celebrait - Creating memories, one card at a time
    `
  };
}

// Send card preview email to prospects
export async function sendBackgroundEmail(cardId: number, email: string, userName: string): Promise<boolean> {
  console.log('Sending background email for card:', cardId, 'to:', email);
  
  if (!hasValidBrevoConfig()) {
    console.log('Brevo not configured, skipping email send');
    return false;
  }

  try {
    // Get card data from storage
    const card = await storage.getCard(cardId);
    if (!card) {
      console.error('Card not found for background email:', cardId);
      return false;
    }

    // Build preview URL
    const host = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
    const previewUrl = `https://${host}/card-preview/${cardId}`;
    
    // Prepare card data for email template
    const conversationData = card.conversationData as any;
    const cardData = {
      email,
      recipientName: conversationData?.name || 'your loved one',
      celebrationType: conversationData?.celebration || 'celebration',
      customerName: userName
    };
    
    // Generate and send the email
    const emailParams = generateCardPreviewEmail(cardData, previewUrl);
    const success = await sendEmail(emailParams);
    
    if (success) {
      console.log('Card preview email sent successfully to:', email);
    } else {
      console.error('Failed to send card preview email to:', email);
    }
    
    return success;
    
  } catch (error: any) {
    console.error('Error sending background email:', error);
    return false;
  }
}

export function generateCardReadyNotificationEmail(orderData: any, host?: string): EmailParams {
  const { customerEmail, customerName, paymentReference, cardType } = orderData;

  // Use proper domain detection - if host contains localhost or undefined, use Replit domain
  const actualHost = (!host || host.includes('localhost')) ? 
    '71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev' : 
    host;

  // Send users to card preview first, then they'll proceed to delivery details
  const nextStepUrl = `https://${actualHost}/card-preview/${paymentReference}`;

  return {
    to: customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Celebrait card is ready to view! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Celebrait Card is Ready!</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; 
            line-height: 1.6; 
            color: #1a1a1a; 
            background: #f8f9fa;
            padding: 20px 0;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(139, 92, 246, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
          }
          .logo {
            width: 80px;
            height: 80px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            font-weight: bold;
          }
          .header h1 { 
            font-size: 28px; 
            font-weight: 700; 
            margin-bottom: 8px; 
            letter-spacing: -0.5px;
          }
          .header p { 
            font-size: 16px; 
            opacity: 0.9; 
            font-weight: 400;
          }
          .content { 
            padding: 40px 30px; 
          }
          .greeting {
            font-size: 24px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 20px;
          }
          .message {
            font-size: 16px;
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.7;
          }
          .card-highlight {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border: 2px solid transparent;
            background-clip: padding-box;
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
            position: relative;
            overflow: hidden;
          }
          .card-highlight::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #8b5cf6, #ec4899);
            margin: -2px;
            border-radius: 12px;
            z-index: -1;
          }
          .card-highlight h3 {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 12px;
          }
          .card-highlight p {
            color: #4a5568;
            margin-bottom: 20px;
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); 
            color: white; 
            padding: 16px 32px; 
            text-decoration: none; 
            border-radius: 12px; 
            font-weight: 600; 
            font-size: 16px;
            text-align: center;
            box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
          }
          .button-center {
            text-align: center;
            margin: 30px 0;
          }
          .footer { 
            background: #f8fafc;
            padding: 30px; 
            text-align: center; 
            border-top: 1px solid #e2e8f0;
          }
          .footer p {
            color: #718096;
            font-size: 14px;
            margin-bottom: 8px;
          }
          .footer .brand {
            color: #4a5568;
            font-weight: 600;
            margin-bottom: 16px;
          }
          @media (max-width: 600px) {
            .content { padding: 30px 20px; }
            .header { padding: 30px 20px; }
            .greeting { font-size: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎉</div>
            <h1>Your Card is Ready!</h1>
            <p>Your personalized creation awaits</p>
          </div>
          
          <div class="content">
            <div class="greeting">Greetings, ${customerName || 'friend'}!</div>
            
            <div class="message">
              Fantastic news! Your personalized greeting card has been beautifully generated and is ready for you to view and enjoy.
            </div>
            
            <div class="card-highlight">
              <h3>🎨 Your custom card is ready</h3>
              <p>Take a moment to see your beautiful creation. You can preview, download, or share your card right away!</p>
              
              <div class="button-center">
                <a href="${nextStepUrl}" class="button">View Your Card Now</a>
              </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #f0f4ff 0%, #fef7ff 100%); padding: 20px; border-radius: 12px; margin: 30px 0; text-align: center;">
              <p style="color: #6b46c1; font-weight: 600; margin: 0;">Questions? We're here to help!</p>
              <p style="color: #7c3aed; font-size: 14px; margin: 8px 0 0;">Reply to this email or contact support@celebrait.co.za</p>
            </div>
          </div>
          
          <div class="footer">
            <p class="brand">Celebrait</p>
            <p>Creating memories, one card at a time</p>
            <p style="font-size: 12px; margin-top: 16px;">© 2025 Celebrait. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Greetings, ${customerName || 'friend'}!

Fantastic news! Your personalized greeting card has been beautifully generated and is ready for you to view.

View your card now: ${nextStepUrl}

Questions? Contact us at support@celebrait.co.za

© 2025 Celebrait - Creating memories, one card at a time
    `
  };
}