# SendGrid Email Integration Setup

## Overview
SendGrid has been integrated into Celebrait to handle email notifications for order confirmations, digital card deliveries, and shipping notifications.

## Setup Instructions

### 1. SendGrid Account Setup
1. Create a free SendGrid account at [sendgrid.com](https://sendgrid.com)
2. Verify your account and complete the setup process
3. Go to Settings → Sender Authentication
4. Verify your domain OR verify a single sender email address

### 2. API Key Configuration
1. In SendGrid dashboard, go to Settings → API Keys
2. Click "Create API Key"
3. Choose "Restricted Access" and enable only "Mail Send" permissions
4. Copy the generated API key
5. Add it to your Replit secrets as `SENDGRID_API_KEY`

### 3. Sender Email Configuration
Update the sender email addresses in `server/email-service.ts`:

```typescript
// Replace 'noreply@yourdomain.com' with your verified sender email
from: 'orders@yourdomain.com'  // For order confirmations
from: 'cards@yourdomain.com'   // For digital card delivery
from: 'shipping@yourdomain.com' // For shipping notifications
```

**Important**: The sender email must be verified in your SendGrid account.

## Email Types

### 1. Order Confirmation Email
- Sent automatically when a paid order is created
- Contains order details, reference number, and amount
- Includes tracking link for order status

### 2. Digital Card Delivery Email
- Sent when digital cards are ready
- Includes the card image as an attachment/preview
- Provides download link for high-quality version

### 3. Shipping Notification Email
- Sent when physical cards are shipped
- Contains tracking number and delivery estimates
- Triggered via `/api/send-shipping-notification` endpoint

## API Endpoints

### Send Shipping Notification
```
POST /api/send-shipping-notification
{
  "orderId": 123,
  "trackingNumber": "TRK123456789"
}
```

### Create Free Digital Order
```
POST /api/create-free-order
{
  "cardId": 123,
  "customerEmail": "user@example.com",
  "customerName": "John Doe"
}
```

## Troubleshooting

### Common Issues

1. **403 Forbidden Error**
   - Check that your API key has "Mail Send" permissions
   - Verify that the sender email is authenticated in SendGrid
   - Ensure API key is correctly set in environment variables

2. **Email Not Delivered**
   - Check SendGrid Activity dashboard for delivery status
   - Verify recipient email address is valid
   - Check spam/junk folders

3. **Template Issues**
   - Ensure HTML templates are properly formatted
   - Test with plain text fallback
   - Verify all template variables are provided

### Testing
Use the test endpoint to verify email functionality:
```bash
curl -X POST http://localhost:5000/api/create-payment-with-tip \
  -H "Content-Type: application/json" \
  -d '{"cardId": 1, "customerInfo": {"email": "test@example.com", ...}}'
```

Check server logs for email sending status and any error messages.

## Email Templates
Email templates include:
- Responsive HTML design
- Celebrait branding
- Clear call-to-action buttons
- Plain text fallbacks
- Professional styling with gradients and shadows

All templates are mobile-friendly and include proper email headers for deliverability.