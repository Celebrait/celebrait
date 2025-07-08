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
  // Note: passphrase is NOT included in form data, only used for signature generation
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
    // Check if live credentials are available
    const hasLiveCredentials = !!(process.env.PAYFAST_LIVE_MERCHANT_ID && process.env.PAYFAST_LIVE_MERCHANT_KEY);
    // Use live mode only if live credentials are available AND we're in production or force live is set
    const useLive = hasLiveCredentials && (process.env.PAYFAST_FORCE_LIVE === 'true' || process.env.NODE_ENV === 'production');
    
    this.config = {
      merchantId: useLive ? process.env.PAYFAST_LIVE_MERCHANT_ID! : (process.env.PAYFAST_MERCHANT_ID || ''),
      merchantKey: useLive ? process.env.PAYFAST_LIVE_MERCHANT_KEY! : (process.env.PAYFAST_MERCHANT_KEY || ''),
      passphrase: useLive ? (process.env.PAYFAST_LIVE_PASSPHRASE || '') : (process.env.PAYFAST_PASSPHRASE || ''),
      sandbox: !useLive
    };
    
    console.log('Payfast config loaded:', {
      mode: useLive ? 'LIVE' : 'SANDBOX',
      merchantId: this.config.merchantId,
      merchantKey: this.config.merchantKey.substring(0, 5) + '...',
      passphraseSet: !!this.config.passphrase,
      hasLiveCredentials,
      sandbox: this.config.sandbox
    });

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
   * Generate MD5 signature for Payfast payment according to official Payfast docs
   */
  private generateSignature(data: Record<string, string>, passphrase?: string): string {
    // Remove signature and passphrase fields if they exist
    const { signature, passphrase: _, ...cleanData } = data;
    
    // Payfast requires parameters in SPECIFIC ORDER as they appear in documentation
    const orderedFields = [
      'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
      'name_first', 'name_last', 'email_address', 'cell_number', 'm_payment_id',
      'amount', 'item_name', 'item_description', 'custom_int1', 'custom_int2',
      'custom_int3', 'custom_int4', 'custom_int5', 'custom_str1', 'custom_str2',
      'custom_str3', 'custom_str4', 'custom_str5', 'subscription_type',
      'billing_date', 'frequency', 'cycles'
    ];
    
    // Build parameter string in correct order, skipping empty values
    const params: string[] = [];
    for (const field of orderedFields) {
      if (cleanData[field] && cleanData[field].toString().trim() !== '') {
        const value = cleanData[field].toString().trim();
        // Payfast requires specific URL encoding: uppercase, spaces as +
        const encodedValue = encodeURIComponent(value)
          .replace(/'/g, '%27')
          .replace(/~/g, '%7E')
          .replace(/%20/g, '+');
        params.push(`${field}=${encodedValue}`);
      }
    }
    
    const paramString = params.join('&');
    
    // Add passphrase if provided (must be last, also URL encoded)
    let stringToSign = paramString;
    if (passphrase) {
      const encodedPassphrase = encodeURIComponent(passphrase)
        .replace(/'/g, '%27')
        .replace(/~/g, '%7E')
        .replace(/%20/g, '+');
      stringToSign = `${paramString}&passphrase=${encodedPassphrase}`;
    }
    
    console.log('Payfast signature string:', stringToSign);
    
    // Generate MD5 hash (must be lowercase)
    const hash = crypto.createHash('md5').update(stringToSign).digest('hex');
    console.log('Payfast generated signature:', hash);
    
    return hash;
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

    // Generate signature with appropriate passphrase
    const passphraseToUse = this.config.sandbox ? 'jt7NOE43FZPn' : this.config.passphrase;
    const signature = this.generateSignature(paymentData, passphraseToUse);
    console.log(`Generated signature with ${this.config.sandbox ? 'sandbox' : 'live'} passphrase:`, signature);

    return {
      ...paymentData,
      signature
      // Note: passphrase is NOT included in form submission, only used for signature generation
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
   * Test signature generation with minimal data
   */
  testSignature(): any {
    const testData = {
      merchant_id: '10000100',
      merchant_key: '46f0cd694581a',
      amount: '100.00',
      item_name: 'Test Item'
    };
    
    const signature = this.generateSignature(testData);
    
    return {
      testData,
      signature,
      paramString: Object.keys(testData).sort().map(k => `${k}=${encodeURIComponent(testData[k])}`).join('&')
    };
  }

  /**
   * Get configuration status
   */
  getStatus() {
    const hasLiveCredentials = !!(process.env.PAYFAST_LIVE_MERCHANT_ID && process.env.PAYFAST_LIVE_MERCHANT_KEY);
    return {
      configured: this.isConfigured(),
      sandbox: this.config.sandbox,
      mode: this.config.sandbox ? 'SANDBOX' : 'LIVE',
      merchantId: this.config.merchantId ? 'configured' : 'missing',
      merchantKey: this.config.merchantKey ? 'configured' : 'missing',
      passphrase: this.config.passphrase ? 'configured' : 'optional',
      hasLiveCredentials,
      environment: process.env.NODE_ENV
    };
  }
}

export const payfastService = new PayfastService();