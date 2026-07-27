const bcrypt = require('bcrypt');
const db = require('./config/db');
async function ensureUser({ name, phone, passwordHash, role }) {
  const result = await db.query(
    `INSERT INTO users (name, phone, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id`,
    [name, phone, passwordHash, role]
  );
  return result.rows[0].id;
}

async function ensureFarmer({ userId, collectorId, farmerCode, village }) {
  const result = await db.query(
    `INSERT INTO farmers (user_id, collector_id, farmer_code, village, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (farmer_code) DO UPDATE SET farmer_code = EXCLUDED.farmer_code
     RETURNING id`,
    [userId, collectorId, farmerCode, village]
  );
  return result.rows[0].id;
}

async function run() {
  try {
    const passwordHash = await bcrypt.hash('adminpass', 10);
    const adminId = await ensureUser({
      name: 'KELVIN KIPRUTO',
      phone: '0733333333',
      passwordHash,
      role: 'admin',
    });
    const collectorId = await ensureUser({
      name: 'Mary Wanjiku',
      phone: '0712345678',
      passwordHash,
      role: 'collector',
    });
    const farmerOneId = await ensureUser({
      name: 'Peter Mwangi',
      phone: '0723456789',
      passwordHash,
      role: 'farmer',
    });
    const farmerTwoId = await ensureUser({
      name: 'Grace Njeri',
      phone: '0798765432',
      passwordHash,
      role: 'farmer',
    });

    const farmerOne = await ensureFarmer({
      userId: farmerOneId,
      collectorId,
      farmerCode: 'FRM-001',
      village: 'Githunguri',
    });
    const farmerTwo = await ensureFarmer({
      userId: farmerTwoId,
      collectorId,
      farmerCode: 'FRM-002',
      village: 'Limuru',
    });

    const collectionCount = await db.query('SELECT COUNT(*)::int AS count FROM milk_collections');
    if (collectionCount.rows[0].count === 0) {
      await db.query(
        `INSERT INTO milk_collections (farmer_id, collector_id, collected_at, liters, total_amount)
         VALUES
           ($1, $3, CURRENT_DATE, 18.5, 925),
           ($2, $3, CURRENT_DATE, 14.0, 700),
           ($1, $3, CURRENT_DATE - INTERVAL '1 day', 17.2, 860),
           ($2, $3, CURRENT_DATE - INTERVAL '1 day', 15.5, 775)`,
        [farmerOne, farmerTwo, collectorId]
      );
    }

    const paymentCount = await db.query('SELECT COUNT(*)::int AS count FROM payments');
    if (paymentCount.rows[0].count === 0) {
      await db.query(
        `INSERT INTO payments (farmer_id, collector_id, amount, payment_date, status, method, phone_number, notes)
         VALUES
           ($1, $3, 1500, CURRENT_DATE, 'paid', 'mpesa', '0723456789', 'Demo payment'),
           ($2, $3, 1200, CURRENT_DATE, 'pending', 'mpesa', '0798765432', 'Scheduled payment')`,
        [farmerOne, farmerTwo, collectorId]
      );
    }

    console.log(`Seeded demo data for admin ${adminId} and collector ${collectorId}.`);
  } catch (err) {
    console.error('Seed failed', err);
    process.exitCode = 1;
  }
}

run();
