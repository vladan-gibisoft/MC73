const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './data/database.sqlite';
const absolutePath = path.resolve(__dirname, '../../', dbPath);

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(absolutePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(absolutePath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
const initSchema = () => {
  // Building configuration (single record)
  db.exec(`
    CREATE TABLE IF NOT EXISTS building (
      id INTEGER PRIMARY KEY,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      bank_account TEXT NOT NULL,
      default_amount DECIMAL(10,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT 0,
      is_user BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Apartments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS apartments (
      id INTEGER PRIMARY KEY,
      apartment_number INTEGER NOT NULL UNIQUE,
      owner_name TEXT NOT NULL,
      floor_number INTEGER NOT NULL,
      apartment_on_floor INTEGER NOT NULL,
      override_amount DECIMAL(10,2),
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Monthly billing records
  db.exec(`
    CREATE TABLE IF NOT EXISTS billings (
      id INTEGER PRIMARY KEY,
      apartment_id INTEGER NOT NULL,
      billing_month INTEGER NOT NULL,
      billing_year INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      reference_number TEXT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
      UNIQUE(apartment_id, billing_month, billing_year)
    )
  `);

  // Payment records
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY,
      apartment_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_date DATE NOT NULL,
      billing_id INTEGER,
      notes TEXT,
      recorded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
      FOREIGN KEY (billing_id) REFERENCES billings(id) ON DELETE SET NULL,
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    )
  `);

  console.log('Database schema initialized');
};

// Auto-initialize schema on load
initSchema();

// Check if this is first run (no users exist)
const isFirstRun = () => {
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
  return result.count === 0;
};

// Get building configuration
const getBuilding = () => {
  return db.prepare('SELECT * FROM building WHERE id = 1').get();
};

// Prepared statements (created after schema initialization)
const prepareStatements = {
  // Users
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  getAllUsers: db.prepare('SELECT id, email, name, is_admin, is_user, created_at, updated_at FROM users'),
  insertUser: db.prepare('INSERT INTO users (email, password_hash, name, is_admin, is_user) VALUES (?, ?, ?, ?, ?)'),
  updateUser: db.prepare('UPDATE users SET email = ?, name = ?, is_admin = ?, is_user = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  updateUserPassword: db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

  // Building
  getBuilding: db.prepare('SELECT * FROM building WHERE id = 1'),
  upsertBuilding: db.prepare(`
    INSERT INTO building (id, address, city, bank_account, default_amount)
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      address = excluded.address,
      city = excluded.city,
      bank_account = excluded.bank_account,
      default_amount = excluded.default_amount,
      updated_at = CURRENT_TIMESTAMP
  `),

  // Apartments
  getApartmentById: db.prepare('SELECT * FROM apartments WHERE id = ?'),
  getApartmentByNumber: db.prepare('SELECT * FROM apartments WHERE apartment_number = ?'),
  getApartmentByUserId: db.prepare('SELECT * FROM apartments WHERE user_id = ?'),
  getAllApartments: db.prepare('SELECT * FROM apartments ORDER BY apartment_number'),
  insertApartment: db.prepare('INSERT INTO apartments (apartment_number, owner_name, floor_number, apartment_on_floor, override_amount, user_id) VALUES (?, ?, ?, ?, ?, ?)'),
  updateApartment: db.prepare('UPDATE apartments SET apartment_number = ?, owner_name = ?, floor_number = ?, apartment_on_floor = ?, override_amount = ?, user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteApartment: db.prepare('DELETE FROM apartments WHERE id = ?'),

  // Billings
  getBillingById: db.prepare('SELECT * FROM billings WHERE id = ?'),
  getBillingsByMonth: db.prepare('SELECT b.*, a.apartment_number, a.owner_name FROM billings b JOIN apartments a ON b.apartment_id = a.id WHERE b.billing_year = ? AND b.billing_month = ? ORDER BY a.apartment_number'),
  getBillingsByApartment: db.prepare('SELECT * FROM billings WHERE apartment_id = ? ORDER BY billing_year DESC, billing_month DESC'),
  getBillingByApartmentMonth: db.prepare('SELECT * FROM billings WHERE apartment_id = ? AND billing_year = ? AND billing_month = ?'),
  insertBilling: db.prepare('INSERT INTO billings (apartment_id, billing_month, billing_year, amount, reference_number) VALUES (?, ?, ?, ?, ?)'),
  deleteBillingsByMonth: db.prepare('DELETE FROM billings WHERE billing_year = ? AND billing_month = ?'),

  // Payments
  getPaymentById: db.prepare('SELECT * FROM payments WHERE id = ?'),
  getPaymentsByApartment: db.prepare('SELECT p.*, u.name as recorded_by_name FROM payments p JOIN users u ON p.recorded_by = u.id WHERE p.apartment_id = ? ORDER BY p.payment_date DESC'),
  getAllPayments: db.prepare('SELECT p.*, a.apartment_number, a.owner_name, u.name as recorded_by_name FROM payments p JOIN apartments a ON p.apartment_id = a.id JOIN users u ON p.recorded_by = u.id ORDER BY p.payment_date DESC'),
  insertPayment: db.prepare('INSERT INTO payments (apartment_id, amount, payment_date, billing_id, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?)'),
  deletePayment: db.prepare('DELETE FROM payments WHERE id = ?'),

  // Balance calculation
  getTotalBillings: db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM billings WHERE apartment_id = ?'),
  getTotalPayments: db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE apartment_id = ?'),
};

module.exports = {
  db,
  initSchema,
  isFirstRun,
  getBuilding,
  ...prepareStatements
};
