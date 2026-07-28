const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all collectors
router.get('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const query = `SELECT id, name, phone, role, status, created_at FROM users WHERE role = 'collector' ORDER BY created_at DESC`;
    const result = await db.query(query);
    res.json({ collectors: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch collectors' });
  }
});

// Create a new collector
router.post('/', authenticate, authorize(['admin']), async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone, and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const query = `INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, 'collector') RETURNING id, name, phone, role, status, created_at`;
    const result = await db.query(query, [name, phone, passwordHash]);
    res.status(201).json({ collector: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Phone number already exists' });
    }
    res.status(500).json({ error: 'Failed to create collector' });
  }
});

router.patch('/:id/status', authenticate, authorize(['admin']), async (req, res) => {
  const collectorId = parseInt(req.params.id, 10);
  const { status } = req.body;
  if (Number.isNaN(collectorId) || !['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'A valid collector ID and status are required' });
  }

  try {
    const result = await db.query(
      `UPDATE users SET status = $1 WHERE id = $2 AND role = 'collector' RETURNING id, name, status`,
      [status, collectorId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Collector not found' });
    await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.user.id, 'UPDATE_COLLECTOR_STATUS', `${status} collector ${result.rows[0].name}`]);
    res.json({ collector: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update collector status' });
  }
});

// Delete a collector
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  const collectorId = parseInt(req.params.id, 10);
  if (Number.isNaN(collectorId)) {
    return res.status(400).json({ error: 'Invalid collector ID' });
  }

  try {
    await db.query('BEGIN');
    const deleteQuery = `DELETE FROM users WHERE id = $1 AND role = 'collector' RETURNING id`;
    const result = await db.query(deleteQuery, [collectorId]);
    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Collector not found' });
    }
    await db.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.user.id, 'DELETE_COLLECTOR', `Deleted collector ID ${collectorId}`]);
    await db.query('COMMIT');
    res.json({ message: 'Collector deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Failed to delete collector' });
  }
});

module.exports = router;
