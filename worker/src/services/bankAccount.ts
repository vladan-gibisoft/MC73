/**
 * Serbian Bank Account Service
 *
 * Format: XXX-XXXXXXXXXXXXX-XX (18 digits total)
 * - First 3 digits: Bank code
 * - Middle 13 digits: Account number (zero-padded)
 * - Last 2 digits: Control number
 */

import type { BankAccountParsed } from '../types';

/**
 * Parse and format Serbian bank account number
 * @param input - Bank account in short or full format
 * @returns Parsed bank account with all formats
 * @throws Error if input is invalid
 */
export function parseBankAccount(input: string): BankAccountParsed {
  if (!input || typeof input !== 'string') {
    throw new Error('Bank account number is required');
  }

  // Remove any dashes, spaces, and other non-digit characters
  const digits = input.replace(/[-\s]/g, '');

  // Validate only digits remain
  if (!/^\d+$/.test(digits)) {
    throw new Error('Bank account must contain only digits');
  }

  if (digits.length === 18) {
    // Already full format
    return {
      bank: digits.slice(0, 3),
      account: digits.slice(3, 16),
      control: digits.slice(16, 18),
      formatted: `${digits.slice(0, 3)}-${digits.slice(3, 16)}-${digits.slice(16, 18)}`,
      digits: digits,
    };
  }

  if (digits.length >= 7 && digits.length < 18) {
    // Short format: first 3 = bank, last 2 = control, middle = account
    const bank = digits.slice(0, 3);
    const control = digits.slice(-2);
    const accountPart = digits.slice(3, -2);
    const account = accountPart.padStart(13, '0');

    return {
      bank,
      account,
      control,
      formatted: `${bank}-${account}-${control}`,
      digits: `${bank}${account}${control}`,
    };
  }

  throw new Error(
    'Invalid bank account format. Must be 7-18 digits (e.g., 16054891267 or 160-0000000548912-67)'
  );
}

/**
 * Format bank account for display with dashes
 * @param bankAccount - Bank account in any format
 * @returns Formatted as XXX-XXXXXXXXXXXXX-XX
 */
export function formatForDisplay(bankAccount: string): string {
  const parsed = parseBankAccount(bankAccount);
  return parsed.formatted;
}

/**
 * Format bank account for QR code (digits only)
 * @param bankAccount - Bank account in any format
 * @returns 18-digit string without dashes
 */
export function formatForQR(bankAccount: string): string {
  const parsed = parseBankAccount(bankAccount);
  return parsed.digits;
}

/**
 * Validate bank account format
 * @param input - Bank account to validate
 * @returns True if valid
 */
export function isValidBankAccount(input: string): boolean {
  try {
    parseBankAccount(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get bank code from account number
 * @param bankAccount - Bank account in any format
 * @returns 3-digit bank code
 */
export function getBankCode(bankAccount: string): string {
  const parsed = parseBankAccount(bankAccount);
  return parsed.bank;
}
