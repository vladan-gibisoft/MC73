import { Context } from 'hono';
import type { Env } from '../types';

// Validation error type
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Return validation error response
 */
export function validationError(c: Context<{ Bindings: Env }>, errors: ValidationError[]) {
  return c.json(
    {
      error: 'Greska u validaciji',
      details: errors,
    },
    400
  );
}

/**
 * Sanitize string input - trims whitespace
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: unknown): boolean {
  const num = parseFloat(String(value));
  return !isNaN(num) && num > 0;
}

/**
 * Validate non-negative number (includes zero)
 */
export function isNonNegativeNumber(value: unknown): boolean {
  const num = parseFloat(String(value));
  return !isNaN(num) && num >= 0;
}

/**
 * Validate apartment number (1-99)
 */
export function isValidApartmentNumber(value: unknown): boolean {
  const num = parseInt(String(value), 10);
  return !isNaN(num) && num >= 1 && num <= 99;
}

/**
 * Validate month (1-12)
 */
export function isValidMonth(value: unknown): boolean {
  const num = parseInt(String(value), 10);
  return !isNaN(num) && num >= 1 && num <= 12;
}

/**
 * Validate year (reasonable range: 2020 to current+5)
 */
export function isValidYear(value: unknown): boolean {
  const num = parseInt(String(value), 10);
  const currentYear = new Date().getFullYear();
  return !isNaN(num) && num >= 2020 && num <= currentYear + 5;
}

/**
 * Validate email format
 */
export function isValidEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate password strength
 * At least 8 characters, one uppercase, one lowercase, one number
 */
export function isStrongPassword(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return true;
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;

  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Validate integer
 */
export function isInteger(value: unknown): boolean {
  const num = parseInt(String(value), 10);
  return !isNaN(num) && Number.isInteger(num);
}

/**
 * Validate that value is not empty string
 */
export function isNotEmpty(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.trim().length > 0;
}

/**
 * Validator builder - creates validation rules for a request body
 */
export interface ValidationRule {
  field: string;
  message: string;
  validate: (value: unknown) => boolean;
  optional?: boolean;
}

/**
 * Validate request body against rules
 * Returns null if valid, or array of errors if invalid
 */
export function validateBody(
  body: Record<string, unknown>,
  rules: ValidationRule[]
): ValidationError[] | null {
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    const value = body[rule.field];

    // Skip validation if optional and not provided
    if (rule.optional && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Required field check
    if (!rule.optional && (value === undefined || value === null)) {
      errors.push({ field: rule.field, message: rule.message });
      continue;
    }

    // Run validation
    if (!rule.validate(value)) {
      errors.push({ field: rule.field, message: rule.message });
    }
  }

  return errors.length > 0 ? errors : null;
}
