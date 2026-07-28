const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { initiateStkPush, normalizePhone } = require('../services/daraja');

const router = express.Router();

router.post('/', authenticate, authorize(['collector']), async (req, res) => {
  const { farmer_id, amount, payment_date, method = 'mpesa', notes } = req.body;
  if (!farmer_id || !amount || !payment_date) {
    return res.status(400).json({ error: 'Farmer ID, amount, and payment_date are required' });
  }

  try {
    const farmerQuery = `SELECT f.id, u.phone FROM farmers f JOIN users u ON f.user_id = u.id WHERE f.id = $1 AND f.collector_id = $2`;
    const farmerResult = await db.query(farmerQuery, [farmer_id, req.user.id]);
    if (farmerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    const farmer = farmerResult.rows[0];
    let status = 'pending';
    let mpesaTransactionId = null;

    let paymentPhone = farmer.phone;
    if (method.toLowerCase() === 'mpesa') {
      const collectorResult = await db.query(`SELECT phone FROM users WHERE id = $1 AND role = 'collector'`, [req.user.id]);
      if (collectorResult.rows.length === 0) {
        return res.status(404).json({ error: 'Collector phone number not found' });
      }
      paymentPhone = normalizePhone(collectorResult.rows[0].phone);
      const stkResponse = await initiateStkPush({
        phone: paymentPhone,
        amount,
        accountReference: `MILK-${farmer_id}`,
        transactionDesc: `Milk payment for farmer ${farmer_id}`,
      });
      status = 'pending';
      mpesaTransactionId = stkResponse.CheckoutRequestID;
    } else {
      status = 'paid';
    }

    const insertQuery = `INSERT INTO payments (farmer_id, collector_id, amount, payment_date, status, method, phone_number, mpesa_transaction_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
    const result = await db.query(insertQuery, [
      farmer_id,
      req.user.id,
      amount,
      payment_date,
      status,
      method,
      paymentPhone,
      mpesaTransactionId,
      notes || null,
    ]);

    const logQuery = `INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)`;
    await db.query(logQuery, [req.user.id, method.toLowerCase() === 'mpesa' ? 'INITIATE_STK_PAYMENT' : 'RECORD_PAYMENT', `Initiated payment of KSh ${amount} via ${method} for farmer ID ${farmer_id}`]);

    res.status(201).json({ payment: result.rows[0] });
  } catch (err) {
    console.error('Payment initiation failed:', err.message);
    res.status(err.code === 'MPESA_CONFIGURATION_ERROR' ? 503 : 500).json({ error: err.message || 'Failed to create payment' });
  }
});

router.post('/callbacks/stk', async (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) return res.sendStatus(200);
  const status = callback.ResultCode === 0 ? 'paid' : 'failed';
  const receipt = callback.CallbackMetadata?.Item?.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
  await db.query(
    `UPDATE payments SET status = $1, mpesa_transaction_id = COALESCE($2, mpesa_transaction_id) WHERE mpesa_transaction_id = $3`,
    [status, receipt || null, callback.CheckoutRequestID]
  ).catch((error) => console.error('STK callback update failed:', error.message));
  res.sendStatus(200);
});

router.post('/callbacks/b2c', async (req, res) => {
  const result = req.body?.Result;
  if (!result?.ConversationID) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  const receipt = result.ResultParameters?.ResultParameter?.find((item) => item.Key === 'TransactionReceipt')?.Value;
  const status = result.ResultCode === 0 ? 'paid' : 'failed';
  await db.query(
    `UPDATE payments SET status = $1, mpesa_transaction_id = COALESCE($2, mpesa_transaction_id) WHERE mpesa_transaction_id = $3`,
    [status, receipt || null, result.ConversationID]
  ).catch((error) => console.error('B2C callback update failed:', error.message));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

router.post('/callbacks/b2c-timeout', (req, res) => {
  console.error('B2C timeout callback:', req.body);
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

router.get('/', authenticate, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'collector') {
      query = `SELECT p.*, f.farmer_code, u.name AS farmer_name FROM payments p JOIN farmers f ON p.farmer_id = f.id JOIN users u ON f.user_id = u.id WHERE p.collector_id = $1 ORDER BY p.payment_date DESC`;
      params = [req.user.id];
    } else if (req.user.role === 'farmer') {
      query = `SELECT p.*, u.name AS collector_name FROM payments p JOIN farmers f ON p.farmer_id = f.id JOIN users u ON p.collector_id = u.id WHERE f.user_id = $1 ORDER BY p.payment_date DESC`;
      params = [req.user.id];
    } else {
      query = `SELECT p.*, f.farmer_code, u.name AS collector_name FROM payments p JOIN farmers f ON p.farmer_id = f.id JOIN users u ON p.collector_id = u.id ORDER BY p.payment_date DESC`;
    }

    const result = await db.query(query, params);
    res.json({ payments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  if (Number.isNaN(paymentId)) {
    return res.status(400).json({ error: 'Invalid payment ID' });
  }

  try {
    const query = `SELECT p.*, f.farmer_code, u.name AS collector_name FROM payments p JOIN farmers f ON p.farmer_id = f.id JOIN users u ON p.collector_id = u.id WHERE p.id = $1`;
    const result = await db.query(query, [paymentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = result.rows[0];
    if (req.user.role === 'collector' && payment.collector_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'farmer') {
      const farmerQuery = `SELECT * FROM farmers WHERE id = $1 AND user_id = $2`;
      const farmerResult = await db.query(farmerQuery, [payment.farmer_id, req.user.id]);
      if (farmerResult.rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json({ payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

module.exports = router;
