const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  const { name, phone, village, farmer_code, password } = req.body;
  if (!name || !phone || !village) {
    return res.status(400).json({ error: 'Name, phone, and village are required' });
  }

  try {
    const trimmedName = String(name).trim();
    const trimmedPhone = String(phone).trim();
    const trimmedVillage = String(village).trim();
    const code = String(farmer_code || '').trim() || `FARMER-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password || 'password123', 10);
    const defaultEmail = `farmer-${trimmedPhone}@milkapp.local`;

    await db.query('BEGIN');

    const userQuery = `INSERT INTO users (name, phone, email, password_hash, role) VALUES ($1, $2, $3, $4, 'farmer') RETURNING id`;
    const userResult = await db.query(userQuery, [trimmedName, trimmedPhone, defaultEmail, passwordHash]);
    const userId = userResult.rows[0].id;

    const farmerQuery = `INSERT INTO farmers (user_id, farmer_code, village, status, collector_id) VALUES ($1, $2, $3, 'active', $4) RETURNING *`;
    const farmerResult = await db.query(farmerQuery, [userId, code, trimmedVillage, req.user.id]);

    const logQuery = `INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)`;
    await db.query(logQuery, [req.user.id, 'REGISTER_FARMER', `Registered farmer ${trimmedName} (${code}) in village ${trimmedVillage}`]);

    await db.query('COMMIT');
    res.status(201).json({ farmer: farmerResult.rows[0] });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Phone or farmer code already exists' });
    }
    res.status(500).json({ error: err.message || 'Failed to create farmer' });
  }
});

router.get('/', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  try {
    const baseQuery = `SELECT f.*, u.name AS name, u.phone AS phone FROM farmers f JOIN users u ON f.user_id = u.id`;
    const params = [];
    let query = baseQuery;

    if (req.user.role === 'collector') {
      query += ` WHERE f.collector_id = $1`;
      params.push(req.user.id);
    }

    const result = await db.query(query, params);
    res.json({ farmers: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch farmers' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  const farmerId = parseInt(req.params.id, 10);
  if (Number.isNaN(farmerId)) {
    return res.status(400).json({ error: 'Invalid farmer ID' });
  }

  try {
    const query = `SELECT f.*, u.name AS name, u.phone AS phone, f.collector_id FROM farmers f JOIN users u ON f.user_id = u.id WHERE f.id = $1`;
    const result = await db.query(query, [farmerId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    const farmer = result.rows[0];
    if (req.user.role === 'farmer' && req.user.id !== farmer.user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.user.role === 'collector' && farmer.collector_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ farmer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch farmer' });
  }
});

router.put('/:id', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  const farmerId = parseInt(req.params.id, 10);
  const { village, status } = req.body;
  if (Number.isNaN(farmerId)) {
    return res.status(400).json({ error: 'Invalid farmer ID' });
  }

  try {
    const updateQuery = `UPDATE farmers SET village = COALESCE($1, village), status = COALESCE($2, status) WHERE id = $3 RETURNING *`;
    const result = await db.query(updateQuery, [village, status, farmerId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }
    res.json({ farmer: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update farmer' });
  }
});

router.patch('/:id/status', authenticate, authorize(['admin']), async (req, res) => {
  const farmerId = parseInt(req.params.id, 10);
  const { status } = req.body;
  if (Number.isNaN(farmerId) || !['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'A valid farmer ID and status are required' });
  }

  try {
    await db.query('BEGIN');
    const result = await db.query(
      `UPDATE farmers SET status = $1 WHERE id = $2 RETURNING user_id, farmer_code`,
      [status, farmerId]
    );
    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Farmer not found' });
    }
    await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, result.rows[0].user_id]);
    await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.user.id, 'UPDATE_FARMER_STATUS', `${status} farmer ${result.rows[0].farmer_code}`]);
    await db.query('COMMIT');
    res.json({ farmer: { id: farmerId, status } });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Failed to update farmer status' });
  }
});

router.delete('/:id', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  const farmerId = parseInt(req.params.id, 10);
  if (Number.isNaN(farmerId)) {
    return res.status(400).json({ error: 'Invalid farmer ID' });
  }

  try {
    await db.query('BEGIN');
    const getUserIdQuery = `SELECT user_id, farmer_code FROM farmers WHERE id = $1`;
    const getUserIdResult = await db.query(getUserIdQuery, [farmerId]);
    if (getUserIdResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Farmer not found' });
    }
    const userId = getUserIdResult.rows[0].user_id;
    const farmerCode = getUserIdResult.rows[0].farmer_code;

    const deleteUserQuery = `DELETE FROM users WHERE id = $1 RETURNING id`;
    await db.query(deleteUserQuery, [userId]);
    
    const logQuery = `INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)`;
    await db.query(logQuery, [req.user.id, 'DELETE_FARMER', `Deleted farmer ID ${farmerId} (Code: ${farmerCode})`]);

    await db.query('COMMIT');
    res.json({ message: 'Farmer deleted' });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to delete farmer' });
  }
});

module.exports = router;
