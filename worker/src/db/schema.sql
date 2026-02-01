-- MC73 Generator Uplatnica - D1 Database Schema
-- Run with: wrangler d1 execute mc73-db --file=./src/db/schema.sql

-- Enable foreign keys (D1 supports this)
PRAGMA foreign_keys = ON;

-- Building configuration (single record with id=1)
CREATE TABLE IF NOT EXISTS building (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  bank_account TEXT NOT NULL,
  default_amount REAL NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT 'Stambena zajednica',
  payment_purpose TEXT NOT NULL DEFAULT 'Mesecno odrzavanje zgrade',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  is_user INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Apartments table
CREATE TABLE IF NOT EXISTS apartments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_number INTEGER NOT NULL UNIQUE,
  owner_name TEXT NOT NULL,
  floor_number INTEGER NOT NULL,
  override_amount REAL,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Monthly billing records
CREATE TABLE IF NOT EXISTS billings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  billing_month INTEGER NOT NULL,
  billing_year INTEGER NOT NULL,
  amount REAL NOT NULL,
  reference_number TEXT NOT NULL,
  generated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  UNIQUE(apartment_id, billing_month, billing_year)
);

-- Payment records
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apartment_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  billing_id INTEGER,
  notes TEXT,
  recorded_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  FOREIGN KEY (billing_id) REFERENCES billings(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_apartments_user_id ON apartments(user_id);
CREATE INDEX IF NOT EXISTS idx_apartments_number ON apartments(apartment_number);
CREATE INDEX IF NOT EXISTS idx_billings_apartment ON billings(apartment_id);
CREATE INDEX IF NOT EXISTS idx_billings_month_year ON billings(billing_year, billing_month);
CREATE INDEX IF NOT EXISTS idx_payments_apartment ON payments(apartment_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
