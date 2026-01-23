const { validationResult } = require('express-validator');

/**
 * Validation error handler middleware
 * Checks for validation errors and returns formatted response
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));

    return res.status(400).json({
      error: 'Greska u validaciji',
      details: formattedErrors
    });
  }

  next();
}

/**
 * Sanitize string input
 * Trims whitespace and removes potentially dangerous characters
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

/**
 * Validate positive number
 */
function isPositiveNumber(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validate apartment number (1-99)
 */
function isValidApartmentNumber(value) {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= 1 && num <= 99;
}

/**
 * Validate month (1-12)
 */
function isValidMonth(value) {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= 1 && num <= 12;
}

/**
 * Validate year (reasonable range)
 */
function isValidYear(value) {
  const num = parseInt(value, 10);
  const currentYear = new Date().getFullYear();
  return !isNaN(num) && num >= 2020 && num <= currentYear + 5;
}

/**
 * Validate email format
 */
function isValidEmail(value) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate password strength
 * At least 8 characters, one uppercase, one lowercase, one number
 */
function isStrongPassword(value) {
  if (value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return true;
}

module.exports = {
  handleValidationErrors,
  sanitizeString,
  isPositiveNumber,
  isValidApartmentNumber,
  isValidMonth,
  isValidYear,
  isValidEmail,
  isStrongPassword
};
