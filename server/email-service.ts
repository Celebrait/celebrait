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
    subject: `🎉 ${recipientName || 'Your loved one'}'s ${celebrationType} card is ready!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .preview-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #667eea; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Your Card Preview is Ready!</h1>
            <p>See how amazing ${recipientName || 'your card'} looks</p>
          </div>
          <div class="content">
            <h2>Hi ${customerName || 'there'}! 👋</h2>
            <p>Great news! Your personalized ${celebrationType} card for <strong>${recipientName}</strong> has been generated and is ready for preview.</p>
            
            <div class="preview-box">
              <h3>🎨 Your Custom Card</h3>
              <p>Take a look at your beautifully designed card and see if it's exactly what you imagined. You can always make changes before ordering!</p>
              
              <div style="text-align: center;">
                <a href="${previewUrl}" class="button">👀 VIEW YOUR CARD PREVIEW</a>
              </div>
            </div>
            
            <h3>What's Next?</h3>
            <ul>
              <li>✅ Preview your card design</li>
              <li>💝 Choose digital delivery or printed card</li>
              <li>🛒 Complete your order (from R129)</li>
              <li>📧 Receive your final card</li>
            </ul>
            
            <p><strong>💡 Pro tip:</strong> This preview link is saved for you - come back anytime to view or order your card!</p>
            
            <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Questions?</strong> Our team is here to help! Simply reply to this email or contact us at support@celebrait.co.za</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${previewUrl}" class="button">🚀 COMPLETE YOUR ORDER NOW</a>
            </div>
          </div>
          <div class="footer">
            <p>Made with ❤️ by Celebrait | Creating memories, one card at a time</p>
            <p>© 2025 Celebrait. All rights reserved.</p>
            <p style="font-size: 12px; color: #999;">You received this email because you created a card on Celebrait. <a href="#">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Card Preview Ready - Celebrait

Hi ${customerName || 'there'}!

Your personalized ${celebrationType} card for ${recipientName} is ready for preview.

View your card: ${previewUrl}

What's next:
✅ Preview your card design
💝 Choose digital or printed delivery  
🛒 Complete your order (from R129)
📧 Receive your final card

Questions? Contact us at support@celebrait.co.za

© 2025 Celebrait
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
    const cardData = {
      email,
      recipientName: card.conversationData?.name || 'your loved one',
      celebrationType: card.conversationData?.celebration || 'celebration',
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