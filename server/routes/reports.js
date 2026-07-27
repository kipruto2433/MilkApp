const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/daily - Today's metrics
router.get('/daily', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('sv', { timeZone: 'Africa/Nairobi' });

    const statsQuery = `
      SELECT 
        COALESCE(SUM(liters), 0) AS liters_today,
        COALESCE(SUM(total_amount), 0) AS amount_today,
        COUNT(DISTINCT farmer_id) AS active_farmers,
        COUNT(DISTINCT collector_id) AS active_collectors
      FROM milk_collections
      WHERE collected_at = $1
    `;
    const statsResult = await db.query(statsQuery, [today]);
    const stats = statsResult.rows[0];

    res.json({
      litersToday: parseFloat(stats.liters_today),
      amountToday: parseFloat(stats.amount_today),
      activeFarmers: parseInt(stats.active_farmers, 10),
      activeCollectors: parseInt(stats.active_collectors, 10)
    });
  } catch (err) {
    console.error('Error fetching daily report:', err);
    res.status(500).json({ error: 'Failed to fetch daily report' });
  }
});

// GET /api/reports/monthly - Monthly aggregates & last 7 days breakdown
router.get('/monthly', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  try {
    const localToday = new Date().toLocaleDateString('sv', { timeZone: 'Africa/Nairobi' });
    const startOfMonthStr = `${localToday.substring(0, 8)}01`;

    // Monthly collection aggregates
    const collQuery = `
      SELECT 
        COALESCE(SUM(liters), 0) AS liters_month,
        COALESCE(SUM(total_amount), 0) AS amount_month
      FROM milk_collections
      WHERE collected_at >= $1
    `;
    const collResult = await db.query(collQuery, [startOfMonthStr]);
    const collections = collResult.rows[0];

    // Monthly payment aggregates
    const payQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN amount ELSE 0 END), 0) AS paid_month,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_month
      FROM payments
      WHERE payment_date >= $1
    `;
    const payResult = await db.query(payQuery, [startOfMonthStr]);
    const payments = payResult.rows[0];

    // Last 7 days breakdown (for weekly charts)
    const breakdownQuery = `
      SELECT 
        TO_CHAR(d.date, 'YYYY-MM-DD') AS collected_date,
        TO_CHAR(d.date, 'Dy') AS day_name,
        COALESCE(SUM(mc.liters), 0) AS liters
      FROM (
        SELECT CURRENT_DATE - i AS date 
        FROM generate_series(0, 6) i
      ) d
      LEFT JOIN milk_collections mc ON mc.collected_at = d.date
      GROUP BY d.date
      ORDER BY d.date ASC
    `;
    const breakdownResult = await db.query(breakdownQuery);

    const dailyBreakdown = breakdownResult.rows.map(row => {
      return {
        date: row.collected_date,
        day: row.day_name,
        liters: parseFloat(row.liters)
      };
    });

    res.json({
      litersMonth: parseFloat(collections.liters_month),
      amountMonth: parseFloat(collections.amount_month),
      paidMonth: parseFloat(payments.paid_month),
      pendingMonth: parseFloat(payments.pending_month),
      dailyBreakdown
    });
  } catch (err) {
    console.error('Error fetching monthly report:', err);
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
});

// GET /api/reports/balances - Balances per farmer
router.get('/balances', authenticate, authorize(['collector', 'admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        f.id AS farmer_id,
        f.farmer_code,
        u.name AS farmer_name,
        u.phone AS farmer_phone,
        f.village,
        f.status,
        COALESCE(c.total_liters, 0) AS total_liters,
        COALESCE(c.total_earned, 0) AS total_earned,
        COALESCE(p.total_paid, 0) AS total_paid,
        GREATEST(0, COALESCE(c.total_earned, 0) - COALESCE(p.total_paid, 0)) AS balance
      FROM farmers f
      JOIN users u ON f.user_id = u.id
      LEFT JOIN (
        SELECT farmer_id, SUM(liters) AS total_liters, SUM(total_amount) AS total_earned
        FROM milk_collections
        GROUP BY farmer_id
      ) c ON f.id = c.farmer_id
      LEFT JOIN (
        SELECT farmer_id, SUM(amount) AS total_paid
        FROM payments
        WHERE status IN ('paid', 'completed')
        GROUP BY farmer_id
      ) p ON f.id = p.farmer_id
      ORDER BY u.name ASC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching balances report:', err);
    res.status(500).json({ error: 'Failed to fetch balances report' });
  }
});

module.exports = router;
