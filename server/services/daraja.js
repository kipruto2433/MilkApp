const DARAJA_BASE_URL = process.env.DARAJA_BASE_URL || 'https://sandbox.safaricom.co.ke';
const isSandbox = process.env.DARAJA_ENV === 'sandbox' || DARAJA_BASE_URL.includes('sandbox.safaricom.co.ke');
const DARAJA_SANDBOX_PHONE = process.env.DARAJA_SANDBOX_PHONE || '254708374149';

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `254${digits}`;
  throw new Error('Enter a valid Kenyan M-Pesa phone number.');
}

function requireConfiguration(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    const error = new Error(`M-Pesa is not configured: ${missing.join(', ')}`);
    error.code = 'MPESA_CONFIGURATION_ERROR';
    throw error;
  }
}

async function darajaRequest(path, options = {}) {
  const response = await fetch(`${DARAJA_BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errorCode) {
    const error = new Error(body.errorMessage || body.error_description || 'M-Pesa request failed.');
    error.code = body.errorCode;
    throw error;
  }
  return body;
}

async function getAccessToken() {
  requireConfiguration(['DARAJA_CONSUMER_KEY', 'DARAJA_CONSUMER_SECRET']);
  const credentials = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString('base64');
  const response = await darajaRequest('/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${credentials}` },
  });
  return response.access_token;
}

async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  requireConfiguration(['DARAJA_SHORTCODE', 'DARAJA_PASSKEY', 'DARAJA_CALLBACK_URL']);
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(`${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${timestamp}`).toString('base64');
  const token = await getAccessToken();
  return darajaRequest('/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: process.env.DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(Number(amount)),
      PartyA: normalizePhone(isSandbox ? DARAJA_SANDBOX_PHONE : phone),
      PartyB: process.env.DARAJA_SHORTCODE,
      PhoneNumber: normalizePhone(isSandbox ? DARAJA_SANDBOX_PHONE : phone),
      CallBackURL: process.env.DARAJA_CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    }),
  });
}

async function sendB2CPayment({ phone, amount, remarks }) {
  requireConfiguration([
    'DARAJA_B2C_INITIATOR_NAME',
    'DARAJA_B2C_SECURITY_CREDENTIAL',
    'DARAJA_B2C_RESULT_URL',
    'DARAJA_B2C_TIMEOUT_URL',
    'DARAJA_SHORTCODE',
  ]);
  const token = await getAccessToken();
  return darajaRequest('/mpesa/b2c/v1/paymentrequest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      InitiatorName: process.env.DARAJA_B2C_INITIATOR_NAME,
      SecurityCredential: process.env.DARAJA_B2C_SECURITY_CREDENTIAL,
      CommandID: process.env.DARAJA_B2C_COMMAND_ID || 'BusinessPayment',
      Amount: Math.round(Number(amount)),
      PartyA: process.env.DARAJA_SHORTCODE,
      PartyB: normalizePhone(phone),
      Remarks: remarks || 'Milk payment',
      QueueTimeOutURL: process.env.DARAJA_B2C_TIMEOUT_URL,
      ResultURL: process.env.DARAJA_B2C_RESULT_URL,
      Occasion: 'Milk supply payment',
    }),
  });
}

module.exports = { initiateStkPush, sendB2CPayment, normalizePhone };
