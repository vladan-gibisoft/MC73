const express = require('express');
const { param, body } = require('express-validator');
const {
  getAllApartments,
  getApartmentById,
  getApartmentByUserId,
  getPaymentsByApartment,
  getAllPayments,
  insertPayment,
  deletePayment,
  getTotalBillings,
  getTotalPayments,
  getBillingById,
  db
} = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

/**
 * Calculate balance for an apartment
 * Positive = prepayment/credit, Negative = owed
 */
function calculateBalance(apartmentId) {
  const totalBillings = getTotalBillings.get(apartmentId);
  const totalPayments = getTotalPayments.get(apartmentId);

  return {
    totalBillings: totalBillings.total || 0,
    totalPayments: totalPayments.total || 0,
    balance: (totalPayments.total || 0) - (totalBillings.total || 0)
  };
}

/**
 * GET /api/payments
 * List payments (admin: all, user: own payments)
 */
router.get('/', authenticate, (req, res) => {
  try {
    if (req.user.is_admin) {
      const payments = getAllPayments.all();
      return res.json(payments);
    }

    // Regular user: get their own apartment's payments
    const apartment = getApartmentByUserId.get(req.user.id);
    if (!apartment) {
      return res.json([]);
    }

    const payments = getPaymentsByApartment.all(apartment.id);
    res.json(payments);

  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja uplata' });
  }
});

/**
 * POST /api/payments
 * Record a new payment (admin only)
 */
router.post('/', [
  authenticate,
  requireAdmin,
  body('apartment_id')
    .notEmpty().withMessage('Stan je obavezan')
    .isInt({ min: 1 }).withMessage('Nevazeci ID stana'),
  body('amount')
    .notEmpty().withMessage('Iznos je obavezan')
    .isFloat({ min: 0.01 }).withMessage('Iznos mora biti pozitivan broj'),
  body('payment_date')
    .notEmpty().withMessage('Datum uplate je obavezan')
    .isISO8601().withMessage('Nevazeci format datuma'),
  body('billing_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Nevazeci ID zaduzenja'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Napomena ne moze biti duza od 500 karaktera'),
  handleValidationErrors
], (req, res) => {
  try {
    const { apartment_id, amount, payment_date, billing_id, notes } = req.body;

    // Verify apartment exists
    const apartment = getApartmentById.get(apartment_id);
    if (!apartment) {
      return res.status(400).json({ error: 'Stan nije pronadjen' });
    }

    // Verify billing exists if provided
    if (billing_id) {
      const billing = getBillingById.get(billing_id);
      if (!billing) {
        return res.status(400).json({ error: 'Zaduzenje nije pronadjeno' });
      }
      if (billing.apartment_id !== apartment_id) {
        return res.status(400).json({ error: 'Zaduzenje ne pripada odabranom stanu' });
      }
    }

    // Insert payment
    const result = insertPayment.run(
      apartment_id,
      amount,
      payment_date,
      billing_id || null,
      notes || null,
      req.user.id
    );

    // Return created payment with apartment info
    const payment = db.prepare(`
      SELECT p.*, a.apartment_number, a.owner_name, u.name as recorded_by_name
      FROM payments p
      JOIN apartments a ON p.apartment_id = a.id
      JOIN users u ON p.recorded_by = u.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(payment);

  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Greska prilikom evidentiranja uplate' });
  }
});

/**
 * DELETE /api/payments/:id
 * Delete a payment (admin only)
 */
router.delete('/:id', [
  authenticate,
  requireAdmin,
  param('id').isInt({ min: 1 }).withMessage('Nevazeci ID uplate'),
  handleValidationErrors
], (req, res) => {
  try {
    const { id } = req.params;

    // Check payment exists
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) {
      return res.status(404).json({ error: 'Uplata nije pronadjena' });
    }

    deletePayment.run(id);

    res.json({ message: 'Uplata je uspesno obrisana' });

  } catch (err) {
    console.error('Delete payment error:', err);
    res.status(500).json({ error: 'Greska prilikom brisanja uplate' });
  }
});

/**
 * GET /api/payments/balance/:apartmentId
 * Get balance for a specific apartment
 */
router.get('/balance/:apartmentId', [
  authenticate,
  param('apartmentId').isInt({ min: 1 }).withMessage('Nevazeci ID stana'),
  handleValidationErrors
], (req, res) => {
  try {
    const apartmentId = parseInt(req.params.apartmentId);

    // Check apartment exists
    const apartment = getApartmentById.get(apartmentId);
    if (!apartment) {
      return res.status(404).json({ error: 'Stan nije pronadjen' });
    }

    // Non-admin can only view their own apartment's balance
    if (!req.user.is_admin) {
      const userApartment = getApartmentByUserId.get(req.user.id);
      if (!userApartment || userApartment.id !== apartmentId) {
        return res.status(403).json({ error: 'Nemate dozvolu za pristup ovom stanu' });
      }
    }

    const balance = calculateBalance(apartmentId);

    res.json({
      apartment_id: apartmentId,
      apartment_number: apartment.apartment_number,
      owner_name: apartment.owner_name,
      ...balance
    });

  } catch (err) {
    console.error('Get balance error:', err);
    res.status(500).json({ error: 'Greska prilikom izracunavanja stanja' });
  }
});

/**
 * GET /api/payments/balances
 * Get balances for all apartments (admin only)
 */
router.get('/balances', [authenticate, requireAdmin], (req, res) => {
  try {
    const apartments = getAllApartments.all();

    const balances = apartments.map(apt => ({
      apartment_id: apt.id,
      apartment_number: apt.apartment_number,
      owner_name: apt.owner_name,
      ...calculateBalance(apt.id)
    }));

    // Sort by apartment number
    balances.sort((a, b) => a.apartment_number - b.apartment_number);

    res.json(balances);

  } catch (err) {
    console.error('Get all balances error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja stanja' });
  }
});

/**
 * GET /api/payments/history/:apartmentId
 * Get payment history for a specific apartment
 */
router.get('/history/:apartmentId', [
  authenticate,
  param('apartmentId').isInt({ min: 1 }).withMessage('Nevazeci ID stana'),
  handleValidationErrors
], (req, res) => {
  try {
    const apartmentId = parseInt(req.params.apartmentId);

    // Check apartment exists
    const apartment = getApartmentById.get(apartmentId);
    if (!apartment) {
      return res.status(404).json({ error: 'Stan nije pronadjen' });
    }

    // Non-admin can only view their own apartment's history
    if (!req.user.is_admin) {
      const userApartment = getApartmentByUserId.get(req.user.id);
      if (!userApartment || userApartment.id !== apartmentId) {
        return res.status(403).json({ error: 'Nemate dozvolu za pristup ovom stanu' });
      }
    }

    // Get combined history of billings and payments
    const billings = db.prepare(`
      SELECT
        'billing' as type,
        generated_at as date,
        -amount as amount,
        reference_number as description,
        billing_month,
        billing_year
      FROM billings
      WHERE apartment_id = ?
    `).all(apartmentId);

    const payments = db.prepare(`
      SELECT
        'payment' as type,
        payment_date as date,
        amount,
        notes as description,
        NULL as billing_month,
        NULL as billing_year
      FROM payments
      WHERE apartment_id = ?
    `).all(apartmentId);

    // Combine and sort by date (most recent first)
    const history = [...billings, ...payments]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate running balance
    let runningBalance = 0;
    const historyWithBalance = history.reverse().map(item => {
      runningBalance += item.amount;
      return { ...item, balance: runningBalance };
    }).reverse();

    res.json({
      apartment_id: apartmentId,
      apartment_number: apartment.apartment_number,
      owner_name: apartment.owner_name,
      current_balance: runningBalance,
      history: historyWithBalance
    });

  } catch (err) {
    console.error('Get payment history error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja istorije' });
  }
});

module.exports = router;
