import { Hono } from 'hono';
import type { Env, Apartment, Building } from '../types';
import {
  getAllApartments,
  getApartmentByUserId,
  getBuilding,
  getBillingsByMonth,
  getBillingsByApartment,
  insertBilling,
  deleteBillingsByMonth,
  getDistinctBillingMonths,
} from '../db/queries';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validationError, isValidMonth, isValidYear, isInteger } from '../middleware/validation';
import { generatePaymentSlipsPDF, generatePDFFilename, generateReferenceNumber } from '../services/pdfGenerator';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/billings
 * List billings (admin: all, user: own billings)
 */
app.get('/', authenticate, async (c) => {
  try {
    const user = c.get('user');

    if (user.is_admin) {
      // Admin can filter by year/month if provided
      const year = c.req.query('year');
      const month = c.req.query('month');

      if (year && month) {
        const billings = await getBillingsByMonth(c.env.DB, parseInt(year, 10), parseInt(month, 10));
        return c.json(billings);
      }

      // Return all billings grouped by month (most recent first)
      const allBillings = await c.env.DB.prepare(`
        SELECT b.*, a.apartment_number, a.owner_name
        FROM billings b
        JOIN apartments a ON b.apartment_id = a.id
        ORDER BY b.billing_year DESC, b.billing_month DESC, a.apartment_number ASC
      `).all();

      return c.json(allBillings.results);
    }

    // Regular user: get their own apartment's billings
    const apartment = await getApartmentByUserId(c.env.DB, user.id);
    if (!apartment) {
      return c.json([]);
    }

    const billings = await getBillingsByApartment(c.env.DB, apartment.id);
    return c.json(billings);
  } catch (err) {
    console.error('Get billings error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja zaduzenja' }, 500);
  }
});

/**
 * POST /api/billings/generate
 * Generate billings for a specific month (admin only)
 */
app.post('/generate', authenticate, requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { year, month } = body;

    // Validate input
    const errors = [];

    if (!isValidYear(year)) {
      errors.push({ field: 'year', message: 'Nevazeca godina' });
    }

    if (!isValidMonth(month)) {
      errors.push({ field: 'month', message: 'Mesec mora biti izmedju 1 i 12' });
    }

    if (errors.length > 0) {
      return validationError(c, errors);
    }

    const yearInt = parseInt(year, 10);
    const monthInt = parseInt(month, 10);

    // Get building config
    const building = await getBuilding(c.env.DB);
    if (!building) {
      return c.json({ error: 'Podaci o zgradi nisu konfigurisani' }, 400);
    }

    // Get all apartments
    const apartments = await getAllApartments(c.env.DB);
    if (apartments.length === 0) {
      return c.json({ error: 'Nema registrovanih stanova' }, 400);
    }

    // Check if billings already exist for this month
    const existingBillings = await getBillingsByMonth(c.env.DB, yearInt, monthInt);
    if (existingBillings.length > 0) {
      return c.json(
        {
          error: `Zaduzenja za ${monthInt}/${yearInt} vec postoje. Obrisite ih pre generisanja novih.`,
        },
        400
      );
    }

    // Generate billings for each apartment
    const billings = [];
    for (const apartment of apartments) {
      const amount = apartment.override_amount || building.default_amount;
      const referenceNumber = generateReferenceNumber(apartment.apartment_number, monthInt);

      const result = await insertBilling(c.env.DB, apartment.id, monthInt, yearInt, amount, referenceNumber);

      billings.push({
        id: result.meta.last_row_id,
        apartment_id: apartment.id,
        apartment_number: apartment.apartment_number,
        owner_name: apartment.owner_name,
        billing_month: monthInt,
        billing_year: yearInt,
        amount: amount,
        reference_number: referenceNumber,
      });
    }

    return c.json(
      {
        message: `Generisano ${billings.length} zaduzenja za ${monthInt}/${yearInt}`,
        billings: billings,
      },
      201
    );
  } catch (err) {
    console.error('Generate billings error:', err);
    return c.json({ error: 'Greska prilikom generisanja zaduzenja' }, 500);
  }
});

/**
 * DELETE /api/billings/:year/:month
 * Delete all billings for a specific month (admin only)
 */
app.delete('/:year/:month', authenticate, requireAdmin, async (c) => {
  try {
    const year = parseInt(c.req.param('year'), 10);
    const month = parseInt(c.req.param('month'), 10);

    if (!isValidYear(year)) {
      return c.json({ error: 'Nevazeca godina' }, 400);
    }

    if (!isValidMonth(month)) {
      return c.json({ error: 'Nevazeci mesec' }, 400);
    }

    const result = await deleteBillingsByMonth(c.env.DB, year, month);

    return c.json({
      message: `Obrisano ${result.meta.changes} zaduzenja za ${month}/${year}`,
    });
  } catch (err) {
    console.error('Delete billings error:', err);
    return c.json({ error: 'Greska prilikom brisanja zaduzenja' }, 500);
  }
});

/**
 * GET /api/billings/pdf/:year/:month
 * Download PDF payment slips for a specific month (admin only)
 */
app.get('/pdf/:year/:month', authenticate, requireAdmin, async (c) => {
  try {
    const year = parseInt(c.req.param('year'), 10);
    const month = parseInt(c.req.param('month'), 10);

    if (!isValidYear(year)) {
      return c.json({ error: 'Nevazeca godina' }, 400);
    }

    if (!isValidMonth(month)) {
      return c.json({ error: 'Nevazeci mesec' }, 400);
    }

    // Get building config
    const building = await getBuilding(c.env.DB);
    if (!building) {
      return c.json({ error: 'Podaci o zgradi nisu konfigurisani' }, 400);
    }

    // Get all apartments
    const apartments = await getAllApartments(c.env.DB);
    if (apartments.length === 0) {
      return c.json({ error: 'Nema registrovanih stanova' }, 400);
    }

    // Generate PDF
    const pdfBuffer = await generatePaymentSlipsPDF(apartments, building, month, year);
    const filename = generatePDFFilename(month, year);

    // Return PDF
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error('Generate PDF error:', err);
    return c.json({ error: 'Greska prilikom generisanja PDF-a' }, 500);
  }
});

/**
 * GET /api/billings/months
 * Get list of months with existing billings (for dropdown)
 */
app.get('/months', authenticate, async (c) => {
  try {
    const months = await c.env.DB.prepare(`
      SELECT DISTINCT billing_year, billing_month, COUNT(*) as count
      FROM billings
      GROUP BY billing_year, billing_month
      ORDER BY billing_year DESC, billing_month DESC
    `).all();

    return c.json(months.results);
  } catch (err) {
    console.error('Get billing months error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja meseci' }, 500);
  }
});

export default app;
