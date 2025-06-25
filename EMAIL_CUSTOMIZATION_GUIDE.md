# Email Template Customization Guide

## Quick Customization Options

### 1. Brand Colors
Edit these values in `server/email-service.ts`:

```css
/* Header gradient - change these hex values */
.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }

/* Button color */
.button { background: #667eea; }

/* Text colors */
body { color: #333; }
.footer { color: #666; }
```

### 2. Company Logo
Add your logo to the header:

```html
<div class="header">
  <img src="https://yourdomain.com/logo.png" alt="Celebrait" style="height: 40px; margin-bottom: 10px;">
  <h1>✨ Order Confirmed!</h1>
</div>
```

### 3. Typography
Change fonts and styling:

```css
body { 
  font-family: 'Helvetica', 'Georgia', 'Times New Roman', Arial, sans-serif; 
  font-size: 16px;
}
h1 { font-size: 28px; }
h2 { font-size: 22px; }
```

### 4. Layout & Spacing
Adjust container and spacing:

```css
.container { max-width: 650px; }  /* Make wider */
.content { padding: 40px; }        /* More padding */
.header { padding: 30px; }         /* Header spacing */
```

### 5. Button Styling
Customize call-to-action buttons:

```css
.button { 
  background: #your-color; 
  padding: 15px 30px;
  border-radius: 25px;  /* Rounded buttons */
  font-weight: bold;
  text-transform: uppercase;
}
```

## Advanced Customization

### 1. Custom Message Content
Edit the text content in each template function:

```javascript
// Order confirmation message
<h2>Hi ${customerName}!</h2>
<p>Your custom message here...</p>

// Subject lines
subject: 'Your Custom Subject - Celebrait'
```

### 2. Additional Email Sections
Add new content blocks:

```html
<div class="custom-section" style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px;">
  <h3>Special Offers</h3>
  <p>Get 20% off your next order with code RETURN20</p>
</div>
```

### 3. Social Media Links
Add social media footer:

```html
<div class="social-links" style="text-align: center; margin-top: 20px;">
  <a href="https://facebook.com/celebrait">Facebook</a> |
  <a href="https://instagram.com/celebrait">Instagram</a> |
  <a href="https://twitter.com/celebrait">Twitter</a>
</div>
```

### 4. Multi-language Support
Create language variations:

```javascript
const messages = {
  en: {
    subject: 'Order Confirmation - Your Celebrait Card',
    greeting: 'Hi ${customerName}!',
    orderConfirmed: 'Order Confirmed!'
  },
  af: {
    subject: 'Bestelling Bevestig - Jou Celebrait Kaart',
    greeting: 'Hallo ${customerName}!',
    orderConfirmed: 'Bestelling Bevestig!'
  }
};
```

## Template Structure

Each email template has these main sections:
1. **Header** - Logo, title, gradient background
2. **Content** - Main message and details
3. **Details Section** - Order/shipping information
4. **Call-to-Action** - Buttons for tracking/downloading
5. **Footer** - Contact info and branding

## Files to Edit

- `server/email-service.ts` - All email templates
- Line 77-85: CSS styles
- Line 88-120: HTML structure
- Functions: `generateOrderConfirmationEmail`, `generateDigitalCardEmail`, `generateShippingNotificationEmail`

## Testing Changes

After making changes, test with:
```bash
curl -X POST http://localhost:5000/api/test-sendgrid \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your-email@domain.com"}'
```

## Pro Tips

1. **Keep it simple** - Email clients have limited CSS support
2. **Use inline styles** - For better compatibility
3. **Test across devices** - Mobile, desktop, different email clients
4. **Include plain text** - Always provide text fallback
5. **Maintain branding** - Keep consistent with your website design