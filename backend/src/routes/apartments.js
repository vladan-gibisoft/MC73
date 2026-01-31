const express = require('express');
const { body, param } = require('express-validator');
const {
  getAllApartments,
  getApartmentById,
  getApartmentByNumber,
  getApartmentByUserId,
  insertApartment,
  updateApartment,
  deleteApartment,
  getUserById
} = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { handleValidationErrors, isValidApartmentNumber } = require('../middleware/validation');

const router = express.Router();

/**
 * GET /api/apartments
 * List apartments (admin: all, user: own apartment)
 */
router.get('/', authenticate, (req, res) => {
  try {
    if (req.user.is_admin) {
      // Admin sees all apartments
      const apartments = getAllApartments.all();
      res.json(apartments);
    } else {
      // User sees only their apartment
      const apartment = getApartmentByUserId.get(req.user.id);
      if (apartment) {
        res.json([apartment]);
      } else {
        res.json([]);
      }
    }
  } catch (err) {
    console.error('Get apartments error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja stanova' });
  }
});

/**
 * GET /api/apartments/:id
 * Get apartment details
 */
router.get('/:id', [
  authenticate,
  param('id').isInt({ min: 1 }).withMessage('Nevazeci ID stana'),
  handleValidationErrors
], (req, res) => {
  try {
    const apartment = getApartmentById.get(req.params.id);

    if (!apartment) {
      return res.status(404).json({ error: 'Stan nije pronadjen' });
    }

    // Non-admin can only view their own apartment
    if (!req.user.is_admin && apartment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Nemate dozvolu za pristup ovom stanu' });
    }

    res.json(apartment);
  } catch (err) {
    console.error('Get apartment error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja stana' });
  }
});

/**
 * POST /api/apartments
 * Create new apartment (admin only)
 */
router.post('/', [
  authenticate,
  requireAdmin,
  body('apartment_number')
    .notEmpty().withMessage('Broj stana je obavezan')
    .isInt({ min: 1, max: 99 }).withMessage('Broj stana mora biti izmedju 1 i 99'),
  body('owner_name')
    .trim()
    .notEmpty().withMessage('Ime vlasnika je obavezno')
    .isLength({ max: 200 }).withMessage('Ime vlasnika ne moze biti duze od 200 karaktera'),
  body('floor_number')
    .notEmpty().withMessage('Sprat je obavezan')
    .isInt({ min: -5, max: 100 }).withMessage('Nevazeci broj sprata'),
  body('override_amount')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Iznos mora biti pozitivan broj'),
  body('user_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Nevazeci ID korisnika'),
  handleValidationErrors
], (req, res) => {
  try {
    const { apartment_number, owner_name, floor_number, override_amount, user_id } = req.body;

    // Check if apartment number already exists
    const existing = getApartmentByNumber.get(apartment_number);
    if (existing) {
      return res.status(400).json({ error: 'Stan sa ovim brojem vec postoji' });
    }

    // Verify user exists if provided
    if (user_id) {
      const user = getUserById.get(user_id);
      if (!user) {
        return res.status(400).json({ error: 'Korisnik sa navedenim ID ne postoji' });
      }
    }

    // Insert apartment
    const result = insertApartment.run(
      apartment_number,
      owner_name,
      floor_number,
      override_amount || null,
      user_id || null
    );

    // Return created apartment
    const apartment = getApartmentById.get(result.lastInsertRowid);
    res.status(201).json(apartment);

  } catch (err) {
    console.error('Create apartment error:', err);
    res.status(500).json({ error: 'Greska prilikom kreiranja stana' });
  }
});

/**
 * PUT /api/apartments/:id
 * Update apartment (admin only)
 */
router.put('/:id', [
  authenticate,
  requireAdmin,
  param('id').isInt({ min: 1 }).withMessage('Nevazeci ID stana'),
  body('apartment_number')
    .notEmpty().withMessage('Broj stana je obavezan')
    .isInt({ min: 1, max: 99 }).withMessage('Broj stana mora biti izmedju 1 i 99'),
  body('owner_name')
    .trim()
    .notEmpty().withMessage('Ime vlasnika je obavezno')
    .isLength({ max: 200 }).withMessage('Ime vlasnika ne moze biti duze od 200 karaktera'),
  body('floor_number')
    .notEmpty().withMessage('Sprat je obavezan')
    .isInt({ min: -5, max: 100 }).withMessage('Nevazeci broj sprata'),
  body('override_amount')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Iznos mora biti pozitivan broj'),
  body('user_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Nevazeci ID korisnika'),
  handleValidationErrors
], (req, res) => {
  try {
    const { id } = req.params;
    const { apartment_number, owner_name, floor_number, override_amount, user_id } = req.body;

    // Check apartment exists
    const apartment = getApartmentById.get(id);
    if (!apartment) {
      return res.status(404).json({ error: 'Stan nije pronadjen' });
    }

    // Check if apartment number already exists (different apartment)
    const existing = getApartmentByNumber.get(apartment_number);
    if (existing && existing.id !== parseInt(id)) {
      return res.status(400).json({ error: 'Stan sa ovim brojem vec postoji' });
    }

    // Verify user exists if provided
    if (user_id) {
      const user = getUserById.get(user_id);
      if (!user) {
        return res.status(400).json({ error: 'Korisnik sa navedenim ID ne postoji' });
      }
    }

    // Update apartment
    updateApartment.run(
      apartment_number,
      owner_name,
      floor_number,
      override_amount || null,
      user_id || null,
      id
    );

    // Return updated apartment
    const updated = getApartmentById.get(id);
    res.json(updated);

  } catch (err) {
    console.error('Update apartment error:', err);
    res.status(500).json({ error: 'Greska prilikom azuriranja stana' });
  }
});

/**
 * DELETE /api/apartments/:id
 * Delete apartment (admin only)
 */
router.delete('/:id', [
  authenticate,
  requireAdmin,
  param('id').isInt({ min: 1 }).withMessage('Nevazeci ID stana'),
  handleValidationErrors
], (req, res) => {
  try {
    const { id } = req.params;

    // Check apartment exists
    const apartment = getApartmentById.get(id);
    if (!apartment) {
      return res.status(404).json({ error: 'Stan nije pronadjen' });
    }

    // Delete apartment (cascade deletes billings and payments)
    deleteApartment.run(id);

    res.json({ message: 'Stan je uspesno obrisan' });

  } catch (err) {
    console.error('Delete apartment error:', err);
    res.status(500).json({ error: 'Greska prilikom brisanja stana' });
  }
});

module.exports = router;
