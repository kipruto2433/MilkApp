const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all system settings
router.get('/', authenticate, async (req, res) => {
  try {
    const query = `SELECT setting_key, setting_value FROM system_settings`;
    const result = await db.query(query);
    
    // Convert array of key-value pairs to an object
    const settingsObj = {};
    result.rows.forEach(row => {
      settingsObj[row.setting_key] = row.setting_value;
    });

    res.json(settingsObj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update a setting
router.put('/', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can update settings' });
  }

  const { setting_key, setting_value } = req.body;
  if (!setting_key || setting_value === undefined) {
    return res.status(400).json({ error: 'setting_key and setting_value are required' });
  }

  try {
    const query = `
      INSERT INTO system_settings (setting_key, setting_value) 
      VALUES ($1, $2)
      ON CONFLICT (setting_key) 
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
    `;
    await db.query(query, [setting_key, setting_value]);
    
    // Log the activity
    const logQuery = `INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)`;
    await db.query(logQuery, [req.user.id, 'UPDATE_SETTING', `Updated setting ${setting_key} to ${setting_value}`]);

    res.json({ message: 'Setting updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;
