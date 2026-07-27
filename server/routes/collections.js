const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, authorize(['collector']), async (req, res) => {
  const { farmer_id, collected_at, liters, total_amount } = req.body;
  if (!farmer_id || !collected_at || !liters || !total_amount) {
    return res.status(400).json({ error: 'Farmer ID, collected_at, liters and total_amount are required' });
  }

  try {
    const query = `INSERT INTO milk_collections (farmer_id, collector_id, collected_at, liters, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const result = await db.query(query, [farmer_id, req.user.id, collected_at, liters, total_amount]);
    
    const logQuery = `INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)`;
    await db.query(logQuery, [req.user.id, 'RECORD_COLLECTION', `Recorded collection of ${liters}L for farmer ID ${farmer_id} on ${collected_at}`]);

    res.status(201).json({ collection: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record collection' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'collector') {
      query = `SELECT mc.*, f.farmer_code, u.name AS farmer_name FROM milk_collections mc JOIN farmers f ON mc.farmer_id = f.id JOIN users u ON f.user_id = u.id WHERE mc.collector_id = $1 ORDER BY mc.collected_at DESC`;
      params = [req.user.id];
    } else if (req.user.role === 'farmer') {
      query = `SELECT mc.*, f.farmer_code, u.name AS collector_name FROM milk_collections mc JOIN farmers f ON mc.farmer_id = f.id JOIN users u ON mc.collector_id = u.id WHERE f.user_id = $1 ORDER BY mc.collected_at DESC`;
      params = [req.user.id];
    } else {
      query = `SELECT mc.*, f.farmer_code, u.name AS collector_name FROM milk_collections mc JOIN farmers f ON mc.farmer_id = f.id JOIN users u ON mc.collector_id = u.id ORDER BY mc.collected_at DESC`;
    }

    const result = await db.query(query, params);
    res.json({ collections: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  const collectionId = parseInt(req.params.id, 10);
  if (Number.isNaN(collectionId)) {
    return res.status(400).json({ error: 'Invalid collection ID' });
  }

  try {
    const query = `SELECT mc.*, f.farmer_code, u.name AS collector_name FROM milk_collections mc JOIN farmers f ON mc.farmer_id = f.id JOIN users u ON mc.collector_id = u.id WHERE mc.id = $1`;
    const result = await db.query(query, [collectionId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const collection = result.rows[0];
    if (req.user.role === 'collector' && collection.collector_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'farmer') {
      const farmerQuery = `SELECT * FROM farmers WHERE id = $1 AND user_id = $2`;
      const farmerResult = await db.query(farmerQuery, [collection.farmer_id, req.user.id]);
      if (farmerResult.rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json({ collection });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

module.exports = router;
