/**
 * Serbian Bank Account Service
 *
 * Format: XXX-XXXXXXXXXXXXX-XX (18 digits total)
 * - First 3 digits: Bank code
 * - Middle 13 digits: Account number (zero-padded)
 * - Last 2 digits: Control number
 */

/**
 * Parse and format Serbian bank account number
 * @param {string} input - Bank account in short or full format
 * @returns {Object} Parsed bank account with all formats
 * @throws {Error} If input is invalid
 */
function parseBankAccount(input) {
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
      digits: digits
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
      digits: `${bank}${account}${control}`
    };
  }

  throw new Error('Invalid bank account format. Must be 7-18 digits (e.g., 16054891267 or 160-0000000548912-67)');
}

/**
 * Format bank account for display with dashes
 * @param {string} bankAccount - Bank account in any format
 * @returns {string} Formatted as XXX-XXXXXXXXXXXXX-XX
 */
function formatForDisplay(bankAccount) {
  const parsed = parseBankAccount(bankAccount);
  return parsed.formatted;
}

/**
 * Format bank account for QR code (digits only)
 * @param {string} bankAccount - Bank account in any format
 * @returns {string} 18-digit string without dashes
 */
function formatForQR(bankAccount) {
  const parsed = parseBankAccount(bankAccount);
  return parsed.digits;
}

/**
 * Validate bank account format
 * @param {string} input - Bank account to validate
 * @returns {boolean} True if valid
 */
function isValidBankAccount(input) {
  try {
    parseBankAccount(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get bank code from account number
 * @param {string} bankAccount - Bank account in any format
 * @returns {string} 3-digit bank code
 */
function getBankCode(bankAccount) {
  const parsed = parseBankAccount(bankAccount);
  return parsed.bank;
}

/**
 * Express validator custom validator
 */
function bankAccountValidator(value) {
  if (!isValidBankAccount(value)) {
    throw new Error('Invalid bank account format');
  }
  return true;
}

module.exports = {
  parseBankAccount,
  formatForDisplay,
  formatForQR,
  isValidBankAccount,
  getBankCode,
  bankAccountValidator
};
