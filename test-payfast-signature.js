// Test Payfast signature generation
const crypto = require('crypto');

function generatePayfastSignature(data, passphrase) {
  // Remove signature and passphrase if they exist
  const { signature, passphrase: _, ...cleanData } = data;
  
  // Sort parameters alphabetically (most common approach)
  const sortedKeys = Object.keys(cleanData).sort();
  
  const params = [];
  for (const key of sortedKeys) {
    const value = cleanData[key];
    if (value && value.toString().trim() !== '') {
      const trimmedValue = value.toString().trim();
      const encodedValue = encodeURIComponent(trimmedValue);
      params.push(`${key}=${encodedValue}`);
    }
  }
  
  let paramString = params.join('&');
  
  // Add passphrase if provided
  if (passphrase && passphrase.trim() !== '') {
    paramString += `&passphrase=${encodeURIComponent(passphrase.trim())}`;
  }
  
  console.log('Parameter string:', paramString);
  
  // Generate MD5 hash
  const hash = crypto.createHash('md5').update(paramString).digest('hex');
  console.log('Generated signature:', hash);
  
  return hash;
}

// Test with our data
const testData = {
  merchant_id: '10000100',
  merchant_key: '46f0cd694581a',
  return_url: 'http://71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev/payment-success/test123',
  cancel_url: 'http://71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev/payment-cancelled/test123',
  notify_url: 'http://71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev/api/payfast/notify',
  name_first: 'Test',
  name_last: 'User',
  email_address: 'test@celebrait.com',
  m_payment_id: 'test123',
  amount: '129.00',
  item_name: 'Celebrait Printed Greeting Card',
  item_description: 'Personalized greeting card for Sarah'
};

const passphrase = 'Patchcroft123';

console.log('Testing Payfast signature generation:');
generatePayfastSignature(testData, passphrase);