/**
 * Database initialization script
 * Creates schema and default admin user
 * Run with: npm run init-db
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { db, initSchema, isFirstRun, upsertBuilding, insertUser } = require('./database');

const SALT_ROUNDS = 10;

async function initializeDatabase() {
  console.log('Initializing database...');

  // Create schema
  initSchema();

  // Check if first run
  if (isFirstRun()) {
    console.log('First run detected. Creating default admin user...');

    // Hash password
    const passwordHash = await bcrypt.hash('Admin123!', SALT_ROUNDS);

    // Insert default admin
    insertUser.run(
      'admin@zgrada.local',
      passwordHash,
      'Administrator',
      1, // is_admin
      1  // is_user
    );

    console.log('Default admin created:');
    console.log('  Email: admin@zgrada.local');
    console.log('  Password: Admin123!');
    console.log('');
    console.log('IMPORTANT: Change this password after first login!');

    // Insert sample building data
    upsertBuilding.run(
      'Marka Celebonovica 73',
      'Beograd',
      '160-0000000548912-67',
      3500.00
    );

    console.log('');
    console.log('Sample building data created.');
  } else {
    console.log('Database already initialized. Skipping default data creation.');
  }

  console.log('');
  console.log('Database initialization complete.');
  console.log('Database path:', process.env.DATABASE_PATH || './data/database.sqlite');

  // Close database connection
  db.close();
}

initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
