const express = require('express');
const { body } = require('express-validator');
const { getBuilding, upsertBuilding } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { formatForDisplay, isValidBankAccount } = require('../services/bankAccount');

const router = express.Router();

/**
 * GET /api/building
 * Get building configuration
 */
router.get('/', authenticate, (req, res) => {
  try {
    const building = getBuilding.get();

    if (!building) {
      return res.status(404).json({ error: 'Podaci o zgradi nisu konfigurisani' });
    }

    res.json(building);
  } catch (err) {
    console.error('Get building error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja podataka o zgradi' });
  }
});

/**
 * PUT /api/building
 * Update building configuration (admin only)
 */
router.put('/', [
  authenticate,
  requireAdmin,
  body('address')
    .trim()
    .notEmpty().withMessage('Adresa je obavezna')
    .isLength({ max: 200 }).withMessage('Adresa ne moze biti duza od 200 karaktera'),
  body('city')
    .trim()
    .notEmpty().withMessage('Grad je obavezan')
    .isLength({ max: 100 }).withMessage('Naziv grada ne moze biti duzi od 100 karaktera'),
  body('bank_account')
    .trim()
    .notEmpty().withMessage('Broj racuna je obavezan')
    .custom((value) => {
      if (!isValidBankAccount(value)) {
        throw new Error('Nevazeci format broja racuna (npr. 16054891267 ili 160-0000000548912-67)');
      }
      return true;
    }),
  body('default_amount')
    .notEmpty().withMessage('Podrazumevani iznos je obavezan')
    .isFloat({ min: 0.01 }).withMessage('Iznos mora biti pozitivan broj'),
  body('recipient_name')
    .trim()
    .notEmpty().withMessage('Naziv primaoca je obavezan')
    .isLength({ max: 200 }).withMessage('Naziv primaoca ne moze biti duzi od 200 karaktera'),
  body('payment_purpose')
    .trim()
    .notEmpty().withMessage('Svrha uplate je obavezna')
    .isLength({ max: 200 }).withMessage('Svrha uplate ne moze biti duza od 200 karaktera'),
  handleValidationErrors
], (req, res) => {
  try {
    const { address, city, bank_account, default_amount, recipient_name, payment_purpose } = req.body;

    // Format bank account before storing
    const formattedBankAccount = formatForDisplay(bank_account);

    // Upsert building data
    upsertBuilding.run(address, city, formattedBankAccount, default_amount, recipient_name, payment_purpose);

    // Return updated building
    const building = getBuilding.get();
    res.json(building);

  } catch (err) {
    console.error('Update building error:', err);
    res.status(500).json({ error: 'Greska prilikom azuriranja podataka o zgradi' });
  }
});

module.exports = router;
