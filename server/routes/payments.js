const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

async function sendMpesaPayment(phone, amount) {
  // Placeholder for MPESA/Daraja integration.
  // In a production build, replace this with the Daraja API request.
  if (!phone) {
    return { status: 'failed', transactionId: null };
  }
  return { status: 'paid', transactionId: `MPESA-${Date.now()}` };
}

router.post('/', authenticate, authorize(['collector']), async (req, res) => {
  const { farmer_id, amount, payment_date, method = 'mpesa', notes } = req.body;
  if (!farmer_id || !amount || !payment_date) {
    return res.status(400).json({ error: 'Farmer ID, amount, and payment_date are required' });
  }

  try {
    const farmerQuery = `SELECT f.id, u.phone FROM farmers f JOIN users u ON f.user_id = u.id WHERE f.id = $1`;
    const farmerResult = await db.query(farmerQuery, [farmer_id]);
    if (farmerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    const farmer = farmerResult.rows[0];
    let status = 'pending';
    let mpesaTransactionId = null;

    if (method.toLowerCase() === 'mpesa') {
      const mpesaResult = await sendMpesaPayment(farmer.phone, amount);
      status = mpesaResult.status;
      mpesaTransactionId = mpesaResult.transactionId;
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
      farmer.phone,
      mpesaTransactionId,
      notes || null,
    ]);

    const logQuery = `INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)`;
    await db.query(logQuery, [req.user.id, 'RECORD_PAYMENT', `Recorded payment of KSh ${amount} via ${method} for farmer ID ${farmer_id}`]);

    res.status(201).json({ payment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
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
