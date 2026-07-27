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
      console.log('Successfully executed statement.');
    } catch (e) {
      console.warn('schema statement status:', e.message);
    }
  }
}

async function run() {
  try {
    console.log('Running migrations...');
    await runSchema();
    console.log('Migrations complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

run();
