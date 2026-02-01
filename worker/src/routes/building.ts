import { Hono } from 'hono';
import type { Env } from '../types';
import { getBuilding, upsertBuilding } from '../db/queries';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validationError, isNotEmpty, isPositiveNumber } from '../middleware/validation';
import { formatForDisplay, isValidBankAccount } from '../services/bankAccount';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/building
 * Get building configuration
 */
app.get('/', authenticate, async (c) => {
  try {
    const building = await getBuilding(c.env.DB);

    if (!building) {
      return c.json({ error: 'Podaci o zgradi nisu konfigurisani' }, 404);
    }

    return c.json(building);
  } catch (err) {
    console.error('Get building error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja podataka o zgradi' }, 500);
  }
});

/**
 * PUT /api/building
 * Update building configuration (admin only)
 */
app.put('/', authenticate, requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { address, city, bank_account, default_amount, recipient_name, payment_purpose } = body;

    // Validate input
    const errors = [];

    if (!address || !isNotEmpty(address)) {
      errors.push({ field: 'address', message: 'Adresa je obavezna' });
    } else if (address.length > 200) {
      errors.push({ field: 'address', message: 'Adresa ne moze biti duza od 200 karaktera' });
    }

    if (!city || !isNotEmpty(city)) {
      errors.push({ field: 'city', message: 'Grad je obavezan' });
    } else if (city.length > 100) {
      errors.push({ field: 'city', message: 'Naziv grada ne moze biti duzi od 100 karaktera' });
    }

    if (!bank_account || !isNotEmpty(bank_account)) {
      errors.push({ field: 'bank_account', message: 'Broj racuna je obavezan' });
    } else if (!isValidBankAccount(bank_account)) {
      errors.push({
        field: 'bank_account',
        message: 'Nevazeci format broja racuna (npr. 16054891267 ili 160-0000000548912-67)',
      });
    }

    if (!default_amount || !isPositiveNumber(default_amount)) {
      errors.push({ field: 'default_amount', message: 'Iznos mora biti pozitivan broj' });
    }

    if (!recipient_name || !isNotEmpty(recipient_name)) {
      errors.push({ field: 'recipient_name', message: 'Naziv primaoca je obavezan' });
    } else if (recipient_name.length > 200) {
      errors.push({ field: 'recipient_name', message: 'Naziv primaoca ne moze biti duzi od 200 karaktera' });
    }

    if (!payment_purpose || !isNotEmpty(payment_purpose)) {
      errors.push({ field: 'payment_purpose', message: 'Svrha uplate je obavezna' });
    } else if (payment_purpose.length > 200) {
      errors.push({ field: 'payment_purpose', message: 'Svrha uplate ne moze biti duza od 200 karaktera' });
    }

    if (errors.length > 0) {
      return validationError(c, errors);
    }

    // Format bank account before storing
    const formattedBankAccount = formatForDisplay(bank_account);

    // Upsert building data
    await upsertBuilding(
      c.env.DB,
      address.trim(),
      city.trim(),
      formattedBankAccount,
      parseFloat(default_amount),
      recipient_name.trim(),
      payment_purpose.trim()
    );

    // Return updated building
    const building = await getBuilding(c.env.DB);
    return c.json(building);
  } catch (err) {
    console.error('Update building error:', err);
    return c.json({ error: 'Greska prilikom azuriranja podataka o zgradi' }, 500);
  }
});

export default app;
