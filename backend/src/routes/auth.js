const express = require('express');
const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const { getUserByEmail } = require('../config/database');
const { generateToken, authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', [
  body('email')
    .trim()
    .notEmpty().withMessage('Email je obavezan')
    .isEmail().withMessage('Nevazeci format email adrese'),
  body('password')
    .notEmpty().withMessage('Lozinka je obavezna'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = getUserByEmail.get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Pogresna email adresa ili lozinka' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Pogresna email adresa ili lozinka' });
    }

    // Generate token
    const token = generateToken(user);

    // Return user info and token
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: Boolean(user.is_admin),
        is_user: Boolean(user.is_user)
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Greska prilikom prijave' });
  }
});

/**
 * POST /api/auth/logout
 * User logout (client-side token removal)
 */
router.post('/logout', (req, res) => {
  // Token removal happens client-side
  // This endpoint just confirms the logout
  res.json({ message: 'Uspesno ste se odjavili' });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.user
  });
});

module.exports = router;
