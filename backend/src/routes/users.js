const express = require('express');
const bcrypt = require('bcrypt');
const { body, param } = require('express-validator');
const {
  getAllUsers,
  getUserById,
  getUserByEmail,
  insertUser,
  updateUser,
  updateUserPassword,
  deleteUser,
  db
} = require('../config/database');
const { authenticate, requireAdmin, requireAdminOrSelf } = require('../middleware/auth');
const { handleValidationErrors, isStrongPassword } = require('../middleware/validation');

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * GET /api/users
 * List all users (admin only)
 */
router.get('/', [authenticate, requireAdmin], (req, res) => {
  try {
    const users = getAllUsers.all();
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja korisnika' });
  }
});

/**
 * GET /api/users/:id
 * Get user details (admin or self)
 */
router.get('/:id', [
  authenticate,
  param('id').isInt({ min: 1 }).withMessage('Nevazeci ID korisnika'),
  handleValidationErrors,
  requireAdminOrSelf((req) => parseInt(req.params.id))
], (req, res) => {
  try {
    const user = getUserById.get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'Korisnik nije pronadjen' });
    }

    // Don't return password hash
    const { password_hash, ...userData } = user;
    res.json(userData);

  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja korisnika' });
  }
});

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post('/', [
  authenticate,
  requireAdmin,
  body('email')
    .trim()
    .notEmpty().withMessage('Email je obavezan')
    .isEmail().withMessage('Nevazeci format email adrese')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Lozinka je obavezna')
    .custom((value) => {
      if (!isStrongPassword(value)) {
        throw new Error('Lozinka mora imati najmanje 8 karaktera, jedno veliko slovo, jedno malo slovo i jedan broj');
      }
      return true;
    }),
  body('name')
    .trim()
    .notEmpty().withMessage('Ime je obavezno')
    .isLength({ max: 200 }).withMessage('Ime ne moze biti duze od 200 karaktera'),
  body('is_admin')
    .optional()
    .isBoolean().withMessage('is_admin mora biti boolean'),
  body('is_user')
    .optional()
    .isBoolean().withMessage('is_user mora biti boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password, name, is_admin = false, is_user = true } = req.body;

    // Check if email already exists
    const existing = getUserByEmail.get(email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Korisnik sa ovom email adresom vec postoji' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const result = insertUser.run(
      email.toLowerCase(),
      passwordHash,
      name,
      is_admin ? 1 : 0,
      is_user ? 1 : 0
    );

    // Return created user (without password)
    const user = getUserById.get(result.lastInsertRowid);
    const { password_hash, ...userData } = user;
    res.status(201).json(userData);

  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Greska prilikom kreiranja korisnika' });
  }
});

/**
 * PUT /api/users/:id
 * Update user (admin or self for limited fields)
 */
router.put('/:id', [
  authenticate,
  param('id').isInt({ min: 1 }).withMessage('Nevazeci ID korisnika'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email je obavezan')
    .isEmail().withMessage('Nevazeci format email adrese')
    .normalizeEmail(),
  body('name')
    .trim()
    .notEmpty().withMessage('Ime je obavezno')
    .isLength({ max: 200 }).withMessage('Ime ne moze biti duze od 200 karaktera'),
  body('password')
    .optional()
    .custom((value) => {
      if (value && !isStrongPassword(value)) {
        throw new Error('Lozinka mora imati najmanje 8 karaktera, jedno veliko slovo, jedno malo slovo i jedan broj');
      }
      return true;
    }),
  body('is_admin')
    .optional()
    .isBoolean().withMessage('is_admin mora biti boolean'),
  body('is_user')
    .optional()
    .isBoolean().withMessage('is_user mora biti boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, password, is_admin, is_user } = req.body;

    // Check user exists
    const user = getUserById.get(id);
    if (!user) {
      return res.status(404).json({ error: 'Korisnik nije pronadjen' });
    }

    // Check permissions
    const isSelf = req.user.id === parseInt(id);
    const isAdmin = req.user.is_admin;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Nemate dozvolu za izmenu ovog korisnika' });
    }

    // Non-admin can only change their own name and password
    if (!isAdmin && isSelf) {
      // Update only allowed fields for non-admin
      if (password) {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        updateUserPassword.run(passwordHash, id);
      }

      // Update name only (keep original email and roles)
      updateUser.run(user.email, name, user.is_admin, user.is_user, id);

      const updated = getUserById.get(id);
      const { password_hash, ...userData } = updated;
      return res.json(userData);
    }

    // Admin can change everything
    // Check if email already exists (different user)
    const existing = getUserByEmail.get(email.toLowerCase());
    if (existing && existing.id !== parseInt(id)) {
      return res.status(400).json({ error: 'Korisnik sa ovom email adresom vec postoji' });
    }

    // Prevent removing last admin
    if (user.is_admin && !is_admin) {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Ne mozete ukloniti poslednjeg administratora' });
      }
    }

    // Update user
    updateUser.run(
      email.toLowerCase(),
      name,
      is_admin !== undefined ? (is_admin ? 1 : 0) : user.is_admin,
      is_user !== undefined ? (is_user ? 1 : 0) : user.is_user,
      id
    );

    // Update password if provided
    if (password) {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      updateUserPassword.run(passwordHash, id);
    }

    // Return updated user
    const updated = getUserById.get(id);
    const { password_hash, ...userData } = updated;
    res.json(userData);

  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Greska prilikom azuriranja korisnika' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/:id', [
  authenticate,
  requireAdmin,
  param('id').isInt({ min: 1 }).withMessage('Nevazeci ID korisnika'),
  handleValidationErrors
], (req, res) => {
  try {
    const { id } = req.params;

    // Check user exists
    const user = getUserById.get(id);
    if (!user) {
      return res.status(404).json({ error: 'Korisnik nije pronadjen' });
    }

    // Prevent deleting self
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ error: 'Ne mozete obrisati sopstveni nalog' });
    }

    // Prevent deleting last admin
    if (user.is_admin) {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Ne mozete obrisati poslednjeg administratora' });
      }
    }

    // Delete user
    deleteUser.run(id);

    res.json({ message: 'Korisnik je uspesno obrisan' });

  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Greska prilikom brisanja korisnika' });
  }
});

module.exports = router;
