import type { D1Database } from '@cloudflare/workers-types';
import type {
  User,
  UserPublic,
  Building,
  Apartment,
  Billing,
  BillingWithApartment,
  Payment,
  PaymentWithDetails,
} from '../types';

// ============================================================================
// USER QUERIES
// ============================================================================

export async function getUserById(db: D1Database, id: number): Promise<User | null> {
  return await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
}

export async function getAllUsers(db: D1Database): Promise<UserPublic[]> {
  const result = await db
    .prepare('SELECT id, email, name, is_admin, is_user, created_at, updated_at FROM users')
    .all<UserPublic>();
  return result.results;
}

export async function insertUser(
  db: D1Database,
  email: string,
  passwordHash: string,
  name: string,
  isAdmin: number,
  isUser: number
): Promise<D1Result> {
  return await db
    .prepare('INSERT INTO users (email, password_hash, name, is_admin, is_user) VALUES (?, ?, ?, ?, ?)')
    .bind(email, passwordHash, name, isAdmin, isUser)
    .run();
}

export async function updateUser(
  db: D1Database,
  id: number,
  email: string,
  name: string,
  isAdmin: number,
  isUser: number
): Promise<D1Result> {
  return await db
    .prepare(
      "UPDATE users SET email = ?, name = ?, is_admin = ?, is_user = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(email, name, isAdmin, isUser, id)
    .run();
}

export async function updateUserPassword(
  db: D1Database,
  id: number,
  passwordHash: string
): Promise<D1Result> {
  return await db
    .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(passwordHash, id)
    .run();
}

export async function deleteUser(db: D1Database, id: number): Promise<D1Result> {
  return await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
}

export async function countUsers(db: D1Database): Promise<number> {
  const result = await db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
  return result?.count ?? 0;
}

// ============================================================================
// BUILDING QUERIES
// ============================================================================

export async function getBuilding(db: D1Database): Promise<Building | null> {
  return await db.prepare('SELECT * FROM building WHERE id = 1').first<Building>();
}

export async function upsertBuilding(
  db: D1Database,
  address: string,
  city: string,
  bankAccount: string,
  defaultAmount: number,
  recipientName: string,
  paymentPurpose: string
): Promise<D1Result> {
  return await db
    .prepare(
      `INSERT INTO building (id, address, city, bank_account, default_amount, recipient_name, payment_purpose)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         address = excluded.address,
         city = excluded.city,
         bank_account = excluded.bank_account,
         default_amount = excluded.default_amount,
         recipient_name = excluded.recipient_name,
         payment_purpose = excluded.payment_purpose,
         updated_at = datetime('now')`
    )
    .bind(address, city, bankAccount, defaultAmount, recipientName, paymentPurpose)
    .run();
}

// ============================================================================
// APARTMENT QUERIES
// ============================================================================

export async function getApartmentById(db: D1Database, id: number): Promise<Apartment | null> {
  return await db.prepare('SELECT * FROM apartments WHERE id = ?').bind(id).first<Apartment>();
}

export async function getApartmentByNumber(
  db: D1Database,
  apartmentNumber: number
): Promise<Apartment | null> {
  return await db
    .prepare('SELECT * FROM apartments WHERE apartment_number = ?')
    .bind(apartmentNumber)
    .first<Apartment>();
}

export async function getApartmentByUserId(db: D1Database, userId: number): Promise<Apartment | null> {
  return await db.prepare('SELECT * FROM apartments WHERE user_id = ?').bind(userId).first<Apartment>();
}

export async function getAllApartments(db: D1Database): Promise<Apartment[]> {
  const result = await db
    .prepare('SELECT * FROM apartments ORDER BY apartment_number')
    .all<Apartment>();
  return result.results;
}

export async function insertApartment(
  db: D1Database,
  apartmentNumber: number,
  ownerName: string,
  floorNumber: number,
  overrideAmount: number | null,
  userId: number | null
): Promise<D1Result> {
  return await db
    .prepare(
      'INSERT INTO apartments (apartment_number, owner_name, floor_number, override_amount, user_id) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(apartmentNumber, ownerName, floorNumber, overrideAmount, userId)
    .run();
}

export async function updateApartment(
  db: D1Database,
  id: number,
  apartmentNumber: number,
  ownerName: string,
  floorNumber: number,
  overrideAmount: number | null,
  userId: number | null
): Promise<D1Result> {
  return await db
    .prepare(
      "UPDATE apartments SET apartment_number = ?, owner_name = ?, floor_number = ?, override_amount = ?, user_id = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(apartmentNumber, ownerName, floorNumber, overrideAmount, userId, id)
    .run();
}

export async function deleteApartment(db: D1Database, id: number): Promise<D1Result> {
  return await db.prepare('DELETE FROM apartments WHERE id = ?').bind(id).run();
}

// ============================================================================
// BILLING QUERIES
// ============================================================================

export async function getBillingById(db: D1Database, id: number): Promise<Billing | null> {
  return await db.prepare('SELECT * FROM billings WHERE id = ?').bind(id).first<Billing>();
}

export async function getBillingsByMonth(
  db: D1Database,
  year: number,
  month: number
): Promise<BillingWithApartment[]> {
  const result = await db
    .prepare(
      `SELECT b.*, a.apartment_number, a.owner_name
       FROM billings b
       JOIN apartments a ON b.apartment_id = a.id
       WHERE b.billing_year = ? AND b.billing_month = ?
       ORDER BY a.apartment_number`
    )
    .bind(year, month)
    .all<BillingWithApartment>();
  return result.results;
}

export async function getBillingsByApartment(db: D1Database, apartmentId: number): Promise<Billing[]> {
  const result = await db
    .prepare('SELECT * FROM billings WHERE apartment_id = ? ORDER BY billing_year DESC, billing_month DESC')
    .bind(apartmentId)
    .all<Billing>();
  return result.results;
}

export async function getBillingByApartmentMonth(
  db: D1Database,
  apartmentId: number,
  year: number,
  month: number
): Promise<Billing | null> {
  return await db
    .prepare('SELECT * FROM billings WHERE apartment_id = ? AND billing_year = ? AND billing_month = ?')
    .bind(apartmentId, year, month)
    .first<Billing>();
}

export async function insertBilling(
  db: D1Database,
  apartmentId: number,
  month: number,
  year: number,
  amount: number,
  referenceNumber: string
): Promise<D1Result> {
  return await db
    .prepare(
      'INSERT INTO billings (apartment_id, billing_month, billing_year, amount, reference_number) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(apartmentId, month, year, amount, referenceNumber)
    .run();
}

export async function deleteBillingsByMonth(
  db: D1Database,
  year: number,
  month: number
): Promise<D1Result> {
  return await db
    .prepare('DELETE FROM billings WHERE billing_year = ? AND billing_month = ?')
    .bind(year, month)
    .run();
}

export async function getDistinctBillingMonths(
  db: D1Database
): Promise<{ billing_year: number; billing_month: number }[]> {
  const result = await db
    .prepare(
      'SELECT DISTINCT billing_year, billing_month FROM billings ORDER BY billing_year DESC, billing_month DESC'
    )
    .all<{ billing_year: number; billing_month: number }>();
  return result.results;
}

// ============================================================================
// PAYMENT QUERIES
// ============================================================================

export async function getPaymentById(db: D1Database, id: number): Promise<Payment | null> {
  return await db.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first<Payment>();
}

export async function getPaymentsByApartment(
  db: D1Database,
  apartmentId: number
): Promise<(Payment & { recorded_by_name: string })[]> {
  const result = await db
    .prepare(
      `SELECT p.*, u.name as recorded_by_name
       FROM payments p
       JOIN users u ON p.recorded_by = u.id
       WHERE p.apartment_id = ?
       ORDER BY p.payment_date DESC`
    )
    .bind(apartmentId)
    .all<Payment & { recorded_by_name: string }>();
  return result.results;
}

export async function getAllPayments(db: D1Database): Promise<PaymentWithDetails[]> {
  const result = await db
    .prepare(
      `SELECT p.*, a.apartment_number, a.owner_name, u.name as recorded_by_name
       FROM payments p
       JOIN apartments a ON p.apartment_id = a.id
       JOIN users u ON p.recorded_by = u.id
       ORDER BY p.payment_date DESC`
    )
    .all<PaymentWithDetails>();
  return result.results;
}

export async function insertPayment(
  db: D1Database,
  apartmentId: number,
  amount: number,
  paymentDate: string,
  billingId: number | null,
  notes: string | null,
  recordedBy: number
): Promise<D1Result> {
  return await db
    .prepare(
      'INSERT INTO payments (apartment_id, amount, payment_date, billing_id, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(apartmentId, amount, paymentDate, billingId, notes, recordedBy)
    .run();
}

export async function deletePayment(db: D1Database, id: number): Promise<D1Result> {
  return await db.prepare('DELETE FROM payments WHERE id = ?').bind(id).run();
}

// ============================================================================
// BALANCE CALCULATION QUERIES
// ============================================================================

export async function getTotalBillings(db: D1Database, apartmentId: number): Promise<number> {
  const result = await db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM billings WHERE apartment_id = ?')
    .bind(apartmentId)
    .first<{ total: number }>();
  return result?.total ?? 0;
}

export async function getTotalPayments(db: D1Database, apartmentId: number): Promise<number> {
  const result = await db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE apartment_id = ?')
    .bind(apartmentId)
    .first<{ total: number }>();
  return result?.total ?? 0;
}

export async function calculateBalance(
  db: D1Database,
  apartmentId: number
): Promise<{ totalBillings: number; totalPayments: number; balance: number }> {
  const totalBillings = await getTotalBillings(db, apartmentId);
  const totalPayments = await getTotalPayments(db, apartmentId);
  const balance = totalPayments - totalBillings; // Positive = prepayment, Negative = owed
  return { totalBillings, totalPayments, balance };
}

// ============================================================================
// UTILITY / HELPER QUERIES
// ============================================================================

export async function isFirstRun(db: D1Database): Promise<boolean> {
  const count = await countUsers(db);
  return count === 0;
}

// D1Result type for TypeScript
interface D1Result {
  success: boolean;
  meta: {
    changes: number;
    last_row_id: number;
    duration: number;
  };
}
