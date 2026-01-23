const express = require('express');
const { param, body } = require('express-validator');
const {
  getAllApartments,
  getApartmentByUserId,
  getBuilding,
  getBillingsByMonth,
  getBillingsByApartment,
  getBillingByApartmentMonth,
  insertBilling,
  deleteBillingsByMonth
} = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { handleValidationErrors, isValidMonth, isValidYear } = require('../middleware/validation');
const { generatePaymentSlipsPDF, generatePDFFilename, generateReferenceNumber } = require('../services/pdfGenerator');

const router = express.Router();

/**
 * GET /api/billings
 * List billings (admin: all, user: own billings)
 */
router.get('/', authenticate, (req, res) => {
  try {
    if (req.user.is_admin) {
      // Admin can filter by year/month if provided
      const { year, month } = req.query;

      if (year && month) {
        const billings = getBillingsByMonth.all(parseInt(year), parseInt(month));
        return res.json(billings);
      }

      // Return all billings grouped by month (most recent first)
      const allBillings = require('../config/database').db
        .prepare(`
          SELECT b.*, a.apartment_number, a.owner_name
          FROM billings b
          JOIN apartments a ON b.apartment_id = a.id
          ORDER BY b.billing_year DESC, b.billing_month DESC, a.apartment_number ASC
        `).all();

      return res.json(allBillings);
    }

    // Regular user: get their own apartment's billings
    const apartment = getApartmentByUserId.get(req.user.id);
    if (!apartment) {
      return res.json([]);
    }

    const billings = getBillingsByApartment.all(apartment.id);
    res.json(billings);

  } catch (err) {
    console.error('Get billings error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja zaduzenja' });
  }
});

/**
 * POST /api/billings/generate
 * Generate billings for a specific month (admin only)
 */
router.post('/generate', [
  authenticate,
  requireAdmin,
  body('year')
    .notEmpty().withMessage('Godina je obavezna')
    .isInt({ min: 2020, max: 2100 }).withMessage('Nevazeca godina'),
  body('month')
    .notEmpty().withMessage('Mesec je obavezan')
    .isInt({ min: 1, max: 12 }).withMessage('Mesec mora biti izmedju 1 i 12'),
  handleValidationErrors
], (req, res) => {
  try {
    const { year, month } = req.body;

    // Get building config
    const building = getBuilding.get();
    if (!building) {
      return res.status(400).json({ error: 'Podaci o zgradi nisu konfigurisani' });
    }

    // Get all apartments
    const apartments = getAllApartments.all();
    if (apartments.length === 0) {
      return res.status(400).json({ error: 'Nema registrovanih stanova' });
    }

    // Check if billings already exist for this month
    const existingBillings = getBillingsByMonth.all(year, month);
    if (existingBillings.length > 0) {
      return res.status(400).json({
        error: `Zaduzenja za ${month}/${year} vec postoje. Obrisite ih pre generisanja novih.`
      });
    }

    // Generate billings for each apartment
    const billings = [];
    for (const apartment of apartments) {
      const amount = apartment.override_amount || building.default_amount;
      const referenceNumber = generateReferenceNumber(apartment.apartment_number, month);

      const result = insertBilling.run(
        apartment.id,
        month,
        year,
        amount,
        referenceNumber
      );

      billings.push({
        id: result.lastInsertRowid,
        apartment_id: apartment.id,
        apartment_number: apartment.apartment_number,
        owner_name: apartment.owner_name,
        billing_month: month,
        billing_year: year,
        amount: amount,
        reference_number: referenceNumber
      });
    }

    res.status(201).json({
      message: `Generisano ${billings.length} zaduzenja za ${month}/${year}`,
      billings: billings
    });

  } catch (err) {
    console.error('Generate billings error:', err);
    res.status(500).json({ error: 'Greska prilikom generisanja zaduzenja' });
  }
});

/**
 * DELETE /api/billings/:year/:month
 * Delete all billings for a specific month (admin only)
 */
router.delete('/:year/:month', [
  authenticate,
  requireAdmin,
  param('year').isInt({ min: 2020, max: 2100 }).withMessage('Nevazeca godina'),
  param('month').isInt({ min: 1, max: 12 }).withMessage('Nevazeci mesec'),
  handleValidationErrors
], (req, res) => {
  try {
    const { year, month } = req.params;

    const result = deleteBillingsByMonth.run(parseInt(year), parseInt(month));

    res.json({
      message: `Obrisano ${result.changes} zaduzenja za ${month}/${year}`
    });

  } catch (err) {
    console.error('Delete billings error:', err);
    res.status(500).json({ error: 'Greska prilikom brisanja zaduzenja' });
  }
});

/**
 * GET /api/billings/pdf/:year/:month
 * Download PDF payment slips for a specific month (admin only)
 */
router.get('/pdf/:year/:month', [
  authenticate,
  requireAdmin,
  param('year').isInt({ min: 2020, max: 2100 }).withMessage('Nevazeca godina'),
  param('month').isInt({ min: 1, max: 12 }).withMessage('Nevazeci mesec'),
  handleValidationErrors
], async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    // Get building config
    const building = getBuilding.get();
    if (!building) {
      return res.status(400).json({ error: 'Podaci o zgradi nisu konfigurisani' });
    }

    // Get all apartments
    const apartments = getAllApartments.all();
    if (apartments.length === 0) {
      return res.status(400).json({ error: 'Nema registrovanih stanova' });
    }

    // Generate PDF
    const pdfBuffer = await generatePaymentSlipsPDF(apartments, building, month, year);
    const filename = generatePDFFilename(month, year);

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Generate PDF error:', err);
    res.status(500).json({ error: 'Greska prilikom generisanja PDF-a' });
  }
});

/**
 * GET /api/billings/months
 * Get list of months with existing billings (for dropdown)
 */
router.get('/months', authenticate, (req, res) => {
  try {
    const months = require('../config/database').db
      .prepare(`
        SELECT DISTINCT billing_year, billing_month, COUNT(*) as count
        FROM billings
        GROUP BY billing_year, billing_month
        ORDER BY billing_year DESC, billing_month DESC
      `).all();

    res.json(months);

  } catch (err) {
    console.error('Get billing months error:', err);
    res.status(500).json({ error: 'Greska prilikom ucitavanja meseci' });
  }
});

module.exports = router;
