const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

dotenv.config();

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { name, phone, password } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone, and password are required' });
  }

  const signupRole = 'collector';

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const userQuery = `INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name`;
    const userResult = await db.query(userQuery, [name, phone, passwordHash, signupRole]);
    const user = userResult.rows[0];

    const token = jwt.sign(
      { id: user.id, name: user.name, role: signupRole },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const userPayload = { id: user.id, name: user.name, phone, role: signupRole };
    res.status(201).json({ token, user: userPayload });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Phone number already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});


router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  try {
    const query = `SELECT id, name, phone, password_hash, role FROM users WHERE phone = $1 LIMIT 1`;
    const result = await db.query(query, [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const userPayload = { id: user.id, name: user.name, phone: user.phone, role: user.role };
    if (user.role === 'farmer') {
      const farmerQuery = `
        SELECT f.farmer_code, f.village, c.name AS collector_name 
        FROM farmers f 
        LEFT JOIN users c ON f.collector_id = c.id 
        WHERE f.user_id = $1 
        LIMIT 1
      `;
      const farmerResult = await db.query(farmerQuery, [user.id]);
      if (farmerResult.rows.length > 0) {
        userPayload.farmer_code = farmerResult.rows[0].farmer_code;
        userPayload.village = farmerResult.rows[0].village;
        userPayload.collector_name = farmerResult.rows[0].collector_name;
      }
    }

    res.json({ token, user: userPayload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const query = `SELECT id, name, phone, role, created_at FROM users WHERE id = $1`;
    const result = await db.query(query, [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    const userPayload = { ...user };
    if (user.role === 'farmer') {
      const farmerQuery = `
        SELECT f.farmer_code, f.village, c.name AS collector_name 
        FROM farmers f 
        LEFT JOIN users c ON f.collector_id = c.id 
        WHERE f.user_id = $1 
        LIMIT 1
      `;
      const farmerResult = await db.query(farmerQuery, [user.id]);
      if (farmerResult.rows.length > 0) {
        userPayload.farmer_code = farmerResult.rows[0].farmer_code;
        userPayload.village = farmerResult.rows[0].village;
        userPayload.collector_name = farmerResult.rows[0].collector_name;
      }
    }
    res.json(userPayload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/change-password', authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password and new password are required' });
  }

  try {
    const query = `SELECT password_hash FROM users WHERE id = $1`;
    const result = await db.query(query, [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Incorrect old password' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const updateQuery = `UPDATE users SET password_hash = $1 WHERE id = $2`;
    await db.query(updateQuery, [newPasswordHash, req.user.id]);

    const logQuery = `INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)`;
    await db.query(logQuery, [req.user.id, 'CHANGE_PASSWORD', 'User changed their password']);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
