const bcrypt = require('bcrypt');
const db = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runSchema() {
  const file = path.join(__dirname, 'schema.sql');
  const content = fs.readFileSync(file, 'utf8');
  const statements = content.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await db.query(stmt);
    } catch (e) {
      console.warn('schema statement status:', e.message);
    }
  }
}

async function run() {
  try {
    console.log('Dropping existing tables...');
    await db.query('DROP TABLE IF EXISTS activity_logs CASCADE');
    await db.query('DROP TABLE IF EXISTS system_settings CASCADE');
    await db.query('DROP TABLE IF EXISTS payments CASCADE');
    await db.query('DROP TABLE IF EXISTS milk_collections CASCADE');
    await db.query('DROP TABLE IF EXISTS farmers CASCADE');
    await db.query('DROP TABLE IF EXISTS users CASCADE');

    console.log('Loading schema...');
    await runSchema();

    console.log('Truncating tables...');
    await db.query('TRUNCATE TABLE payments CASCADE');
    await db.query('TRUNCATE TABLE milk_collections CASCADE');
    await db.query('TRUNCATE TABLE farmers CASCADE');
    await db.query('TRUNCATE TABLE users CASCADE');

    const adminPassword = await bcrypt.hash('adminpass', 10);

    console.log('Inserting users...');
    
    // 1. Admin KELVIN KIPRUTO
    const adminRes = await db.query(
      `INSERT INTO users (name, phone, password_hash, role) 
       VALUES ('KELVIN KIPRUTO', '0733333333', $1, 'admin') RETURNING id`,
      [adminPassword]
    );
    const adminId = adminRes.rows[0].id;

    console.log('Database successfully seeded with fresh Admin account. No transactions, collectors or farmers exist.');

    console.log('Database successfully seeded!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed', err);
    process.exit(1);
  }
}

run();
