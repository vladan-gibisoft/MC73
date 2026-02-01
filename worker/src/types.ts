import type { D1Database } from '@cloudflare/workers-types';

// Environment bindings
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

// Database models
export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  is_admin: number; // SQLite stores boolean as 0/1
  is_user: number;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: number;
  email: string;
  name: string;
  is_admin: number;
  is_user: number;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: number;
  address: string;
  city: string;
  bank_account: string;
  default_amount: number;
  recipient_name: string;
  payment_purpose: string;
  created_at: string;
  updated_at: string;
}

export interface Apartment {
  id: number;
  apartment_number: number;
  owner_name: string;
  floor_number: number;
  override_amount: number | null;
  user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Billing {
  id: number;
  apartment_id: number;
  billing_month: number;
  billing_year: number;
  amount: number;
  reference_number: string;
  created_at: string;
}

export interface BillingWithApartment extends Billing {
  apartment_number: number;
  owner_name: string;
}

export interface Payment {
  id: number;
  apartment_id: number;
  amount: number;
  payment_date: string;
  billing_id: number | null;
  notes: string | null;
  recorded_by: number;
  created_at: string;
}

export interface PaymentWithDetails extends Payment {
  apartment_number: number;
  owner_name: string;
  recorded_by_name: string;
}

// JWT payload
export interface JWTPayload {
  id: number;
  email: string;
  is_admin: number;
  is_user: number;
  iat?: number;
  exp?: number;
}

// Bank account parsed format
export interface BankAccountParsed {
  bank: string;
  account: string;
  control: string;
  formatted: string;
  digits: string;
}

// QR code data for NBS API
export interface QRCodeData {
  K: string;     // Payment type
  V: string;     // Version
  C: string;     // Character set
  R: string;     // Recipient account (18 digits)
  N: string;     // Recipient name
  I: string;     // Amount with currency
  SF: string;    // Service code
  S: string;     // Payment purpose
  RO: string;    // Reference number
  P: string;     // Payer info
}

// Request context with user
export interface AuthenticatedContext {
  user: UserPublic;
}

// API Response types
export interface ApiError {
  error: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  data?: T;
  message?: string;
}
