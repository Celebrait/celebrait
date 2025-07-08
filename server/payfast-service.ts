import crypto from 'crypto';

export interface PayfastPaymentData {
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first: string;
  name_last: string;
  email_address: string;
  m_payment_id: string;
  amount: string;
  item_name: string;
  item_description: string;
  passphrase?: string;
}

export interface PayfastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
}

class PayfastService {
  private config: PayfastConfig;

  constructor() {
    this.config = {
      merchantId: process.env.PAYFAST_MERCHANT_ID || '',
      merchantKey: process.env.PAYFAST_MERCHANT_KEY || '',
      passphrase: process.env.PAYFAST_PASSPHRASE || '',
      sandbox: process.env.NODE_ENV !== 'production'
    };

    if (!this.config.merchantId || !this.config.merchantKey) {
      console.warn('Payfast credentials not configured. Payment processing will be disabled.');
    } else {
      console.log('Payfast configured:', {
        merchantId: this.config.merchantId,
        sandbox: this.config.sandbox,
        hasPassphrase: !!this.config.passphrase
      });
    }
  }

  /**
   * Generate MD5 signature for Payfast payment
   */
  private generateSignature(data: Record<string, string>, passphrase?: string): string {
    // Create parameter string
    const paramString = Object.keys(data)
      .sort()
      .map(key => `${key}=${encodeURIComponent(data[key].toString().trim())}`)
      .join('&');

    // Add passphrase if provided
    const stringToSign = passphrase ? `${paramString}&passphrase=${encodeURIComponent(passphrase)}` : paramString;
    
    // Generate MD5 hash
    return crypto.createHash('md5').update(stringToSign).digest('hex');
  }

  /**
   * Create Payfast payment form data
   */
  createPaymentData(orderData: {
    orderId: string;
    customerName: string;
    customerEmail: string;
    amount: number; // Amount in cents
    itemName: string;
    itemDescription: string;
    returnUrl: string;
    cancelUrl: string;
    notifyUrl: string;
  }): PayfastPaymentData & { signature: string } {
    const baseUrl = this.config.sandbox 
      ? 'https://sandbox.payfast.co.za'
      : 'https://www.payfast.co.za';

    // Split customer name
    const nameParts = orderData.customerName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Prepare payment data
    const paymentData: Record<string, string> = {
      merchant_id: this.config.merchantId,
      merchant_key: this.config.merchantKey,
      return_url: orderData.returnUrl,
      cancel_url: orderData.cancelUrl,
      notify_url: orderData.notifyUrl,
      name_first: firstName,
      name_last: lastName,
      email_address: orderData.customerEmail,
      m_payment_id: orderData.orderId,
      amount: (orderData.amount / 100).toFixed(2), // Convert cents to rands
      item_name: orderData.itemName,
      item_description: orderData.itemDescription
    };

    // Generate signature
    const signature = this.generateSignature(paymentData, this.config.passphrase);

    return {
      ...paymentData,
      signature,
      passphrase: this.config.passphrase
    } as PayfastPaymentData & { signature: string };
  }

  /**
   * Verify ITN (Instant Transaction Notification) from Payfast
   */
  async verifyITN(
    itnData: Record<string, string>,
    pfHost: string = 'sandbox.payfast.co.za'
  ): Promise<{ valid: boolean; verified: boolean }> {
    try {
      // Check if this is a valid transaction
      const valid = itnData.payment_status === 'COMPLETE';

      // Verify signature
      const { signature, ...dataWithoutSignature } = itnData;
      const calculatedSignature = this.generateSignature(dataWithoutSignature, this.config.passphrase);
      const signatureValid = signature === calculatedSignature;

      // Verify with Payfast server
      let serverVerified = false;
      try {
        const response = await fetch(`https://${pfHost}/eng/query/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: Object.keys(itnData)
            .map(key => `${key}=${encodeURIComponent(itnData[key])}`)
            .join('&')
        });

        const result = await response.text();
        serverVerified = result === 'VALID';
      } catch (error) {
        console.error('Payfast server verification failed:', error);
      }

      console.log('Payfast ITN verification:', {
        valid,
        signatureValid,
        serverVerified,
        paymentStatus: itnData.payment_status,
        paymentId: itnData.m_payment_id
      });

      return {
        valid: valid && signatureValid,
        verified: serverVerified
      };
    } catch (error) {
      console.error('Payfast ITN verification error:', error);
      return { valid: false, verified: false };
    }
  }

  /**
   * Get Payfast payment URL
   */
  getPaymentUrl(): string {
    return this.config.sandbox 
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';
  }

  /**
   * Check if Payfast is configured
   */
  isConfigured(): boolean {
    return !!(this.config.merchantId && this.config.merchantKey);
  }

  /**
   * Get configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      sandbox: this.config.sandbox,
      merchantId: this.config.merchantId ? 'configured' : 'missing',
      merchantKey: this.config.merchantKey ? 'configured' : 'missing',
      passphrase: this.config.passphrase ? 'configured' : 'optional'
    };
  }
}

export const payfastService = new PayfastService();