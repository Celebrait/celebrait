# Celebrait Testing Guide

## Complete User Flow Testing

### 1. Main Flow Testing (Most Comprehensive)
**URL:** `/` (Homepage)

**Steps:**
1. Click "Create a Masterpiece" 
2. Choose delivery method (Digital/Printed)
3. Choose photo method (Upload + Scene/Transform)
4. Enter your real name and details
5. Upload actual photos
6. Complete the AI conversation with personal details
7. Wait for card generation (2-3 minutes)
8. Review your generated card
9. Choose delivery options with real email
10. Complete payment (for printed cards)

**What You'll Receive:**
- Card ready notification email
- Digital card delivery email (if digital)
- Order confirmation email (if printed)
- Payment completion confirmation

### 2. Test Dashboard
**URL:** `/test-dashboard`

**Individual Test Functions:**
- Test card ready emails
- Test digital order creation
- Test printed order creation  
- Test shipping notifications
- Configure test parameters (email, names, etc.)

### 3. Live Payment Testing
**URL:** `/live-test`

**Purpose:** Quick payment integration testing
- Test with small amounts (R1.00)
- Verify payment gateway integration
- Test payment completion flow

## Email Testing Configuration

### SendGrid Status
- **Status:** Fully operational
- **Sender:** greetings@celebrait.co.za
- **Test Endpoint:** `/api/test-sendgrid`

### Email Types Supported
1. **Card Ready Notifications** - When card generation completes
2. **Digital Card Delivery** - Contains downloadable card link
3. **Order Confirmations** - Payment successful confirmations
4. **Shipping Notifications** - When printed cards ship

## Payment Testing

### Payfast Integration
- **Sandbox Mode:** Safe testing with fake payments
- **Live Mode:** Real payments with live credentials
- **Test Amounts:** Start with R1.00, then R129.00
- **Cards Supported:** Visa, Mastercard, local South African payment methods

### Currency & Pricing
- **Digital Cards:** Free
- **Printed Cards:** R129.00 (includes shipping)
- **Currency:** South African Rand (ZAR)

## Recommended Testing Sequence

1. **Start with Test Dashboard** (`/test-dashboard`)
   - Test individual email types
   - Verify SendGrid configuration
   - Test order creation

2. **Full User Flow** (`/`)
   - Use your real email for notifications
   - Complete entire card creation process
   - Test with both digital and printed options

3. **Live Payment Testing** (`/live-test`)
   - Test with small amounts first
   - Verify payment completion
   - Check order status updates

## Tips for Effective Testing

- **Use Real Email Addresses** for proper notification testing
- **Check Spam Folders** for email deliveries
- **Monitor Server Logs** for detailed debugging info
- **Test Both Delivery Types** (digital and printed)
- **Verify Payment Notifications** come through properly
- **Test Error Scenarios** (invalid emails, payment failures)

## Environment Notes

- **Development:** Uses sandbox credentials (safe testing)
- **Production:** Automatically switches to live credentials
- **Database:** PostgreSQL with persistent storage
- **File Storage:** Local file system for generated images