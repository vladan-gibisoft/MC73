import { Hono } from 'hono';
import type { Env } from '../types';
import {
  getAllApartments,
  getApartmentById,
  getApartmentByUserId,
  getPaymentsByApartment,
  getAllPayments,
  insertPayment,
  deletePayment,
  getPaymentById,
  getBillingById,
  calculateBalance,
} from '../db/queries';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  validationError,
  isPositiveNumber,
  isValidDate,
  isInteger,
} from '../middleware/validation';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/payments
 * List payments (admin: all, user: own payments)
 */
app.get('/', authenticate, async (c) => {
  try {
    const user = c.get('user');

    if (user.is_admin) {
      const payments = await getAllPayments(c.env.DB);
      return c.json(payments);
    }

    // Regular user: get their own apartment's payments
    const apartment = await getApartmentByUserId(c.env.DB, user.id);
    if (!apartment) {
      return c.json([]);
    }

    const payments = await getPaymentsByApartment(c.env.DB, apartment.id);
    return c.json(payments);
  } catch (err) {
    console.error('Get payments error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja uplata' }, 500);
  }
});

/**
 * POST /api/payments
 * Record a new payment (admin only)
 */
app.post('/', authenticate, requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { apartment_id, amount, payment_date, billing_id, notes } = body;

    // Validate input
    const errors = [];

    if (!apartment_id || !isInteger(apartment_id) || apartment_id < 1) {
      errors.push({ field: 'apartment_id', message: 'Nevazeci ID stana' });
    }

    if (!amount || !isPositiveNumber(amount)) {
      errors.push({ field: 'amount', message: 'Iznos mora biti pozitivan broj' });
    }

    if (!payment_date || !isValidDate(payment_date)) {
      errors.push({ field: 'payment_date', message: 'Nevazeci format datuma' });
    }

    if (billing_id !== undefined && billing_id !== null && (!isInteger(billing_id) || billing_id < 1)) {
      errors.push({ field: 'billing_id', message: 'Nevazeci ID zaduzenja' });
    }

    if (notes && notes.length > 500) {
      errors.push({ field: 'notes', message: 'Napomena ne moze biti duza od 500 karaktera' });
    }

    if (errors.length > 0) {
      return validationError(c, errors);
    }

    // Verify apartment exists
    const apartment = await getApartmentById(c.env.DB, apartment_id);
    if (!apartment) {
      return c.json({ error: 'Stan nije pronadjen' }, 400);
    }

    // Verify billing exists if provided
    if (billing_id) {
      const billing = await getBillingById(c.env.DB, billing_id);
      if (!billing) {
        return c.json({ error: 'Zaduzenje nije pronadjeno' }, 400);
      }
      if (billing.apartment_id !== apartment_id) {
        return c.json({ error: 'Zaduzenje ne pripada odabranom stanu' }, 400);
      }
    }

    const user = c.get('user');

    // Insert payment
    const result = await insertPayment(
      c.env.DB,
      apartment_id,
      parseFloat(amount),
      payment_date,
      billing_id || null,
      notes?.trim() || null,
      user.id
    );

    // Return created payment with apartment info
    const payment = await c.env.DB.prepare(`
      SELECT p.*, a.apartment_number, a.owner_name, u.name as recorded_by_name
      FROM payments p
      JOIN apartments a ON p.apartment_id = a.id
      JOIN users u ON p.recorded_by = u.id
      WHERE p.id = ?
    `)
      .bind(result.meta.last_row_id)
      .first();

    return c.json(payment, 201);
  } catch (err) {
    console.error('Create payment error:', err);
    return c.json({ error: 'Greska prilikom evidentiranja uplate' }, 500);
  }
});

/**
 * DELETE /api/payments/:id
 * Delete a payment (admin only)
 */
app.delete('/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    if (!isInteger(id) || id < 1) {
      return c.json({ error: 'Nevazeci ID uplate' }, 400);
    }

    // Check payment exists
    const payment = await getPaymentById(c.env.DB, id);
    if (!payment) {
      return c.json({ error: 'Uplata nije pronadjena' }, 404);
    }

    await deletePayment(c.env.DB, id);

    return c.json({ message: 'Uplata je uspesno obrisana' });
  } catch (err) {
    console.error('Delete payment error:', err);
    return c.json({ error: 'Greska prilikom brisanja uplate' }, 500);
  }
});

/**
 * GET /api/payments/balance/:apartmentId
 * Get balance for a specific apartment
 */
app.get('/balance/:apartmentId', authenticate, async (c) => {
  try {
    const apartmentId = parseInt(c.req.param('apartmentId'), 10);

    if (!isInteger(apartmentId) || apartmentId < 1) {
      return c.json({ error: 'Nevazeci ID stana' }, 400);
    }

    // Check apartment exists
    const apartment = await getApartmentById(c.env.DB, apartmentId);
    if (!apartment) {
      return c.json({ error: 'Stan nije pronadjen' }, 404);
    }

    const user = c.get('user');

    // Non-admin can only view their own apartment's balance
    if (!user.is_admin) {
      const userApartment = await getApartmentByUserId(c.env.DB, user.id);
      if (!userApartment || userApartment.id !== apartmentId) {
        return c.json({ error: 'Nemate dozvolu za pristup ovom stanu' }, 403);
      }
    }

    const balance = await calculateBalance(c.env.DB, apartmentId);

    return c.json({
      apartment_id: apartmentId,
      apartment_number: apartment.apartment_number,
      owner_name: apartment.owner_name,
      ...balance,
    });
  } catch (err) {
    console.error('Get balance error:', err);
    return c.json({ error: 'Greska prilikom izracunavanja stanja' }, 500);
  }
});

/**
 * GET /api/payments/balances
 * Get balances for all apartments (admin only)
 */
app.get('/balances', authenticate, requireAdmin, async (c) => {
  try {
    const apartments = await getAllApartments(c.env.DB);

    const balances = await Promise.all(
      apartments.map(async (apt) => ({
        apartment_id: apt.id,
        apartment_number: apt.apartment_number,
        owner_name: apt.owner_name,
        ...(await calculateBalance(c.env.DB, apt.id)),
      }))
    );

    // Sort by apartment number
    balances.sort((a, b) => a.apartment_number - b.apartment_number);

    return c.json(balances);
  } catch (err) {
    console.error('Get all balances error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja stanja' }, 500);
  }
});

/**
 * GET /api/payments/history/:apartmentId
 * Get payment history for a specific apartment
 */
app.get('/history/:apartmentId', authenticate, async (c) => {
  try {
    const apartmentId = parseInt(c.req.param('apartmentId'), 10);

    if (!isInteger(apartmentId) || apartmentId < 1) {
      return c.json({ error: 'Nevazeci ID stana' }, 400);
    }

    // Check apartment exists
    const apartment = await getApartmentById(c.env.DB, apartmentId);
    if (!apartment) {
      return c.json({ error: 'Stan nije pronadjen' }, 404);
    }

    const user = c.get('user');

    // Non-admin can only view their own apartment's history
    if (!user.is_admin) {
      const userApartment = await getApartmentByUserId(c.env.DB, user.id);
      if (!userApartment || userApartment.id !== apartmentId) {
        return c.json({ error: 'Nemate dozvolu za pristup ovom stanu' }, 403);
      }
    }

    // Get combined history of billings and payments
    const billingsResult = await c.env.DB.prepare(`
      SELECT
        'billing' as type,
        generated_at as date,
        -amount as amount,
        reference_number as description,
        billing_month,
        billing_year
      FROM billings
      WHERE apartment_id = ?
    `)
      .bind(apartmentId)
      .all();

    const paymentsResult = await c.env.DB.prepare(`
      SELECT
        'payment' as type,
        payment_date as date,
        amount,
        notes as description,
        NULL as billing_month,
        NULL as billing_year
      FROM payments
      WHERE apartment_id = ?
    `)
      .bind(apartmentId)
      .all();

    // Combine and sort by date (most recent first)
    const history = [...billingsResult.results, ...paymentsResult.results].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Calculate running balance
    let runningBalance = 0;
    const historyWithBalance = history
      .reverse()
      .map((item: any) => {
        runningBalance += item.amount;
        return { ...item, balance: runningBalance };
      })
      .reverse();

    return c.json({
      apartment_id: apartmentId,
      apartment_number: apartment.apartment_number,
      owner_name: apartment.owner_name,
      current_balance: runningBalance,
      history: historyWithBalance,
    });
  } catch (err) {
    console.error('Get payment history error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja istorije' }, 500);
  }
});

export default app;
