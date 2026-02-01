import { Hono } from 'hono';
import type { Env } from '../types';
import {
  getAllApartments,
  getApartmentById,
  getApartmentByNumber,
  getApartmentByUserId,
  insertApartment,
  updateApartment,
  deleteApartment,
  getUserById,
} from '../db/queries';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  validationError,
  isNotEmpty,
  isValidApartmentNumber,
  isInteger,
  isNonNegativeNumber,
} from '../middleware/validation';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/apartments
 * List apartments (admin: all, user: own apartment)
 */
app.get('/', authenticate, async (c) => {
  try {
    const user = c.get('user');

    if (user.is_admin) {
      // Admin sees all apartments
      const apartments = await getAllApartments(c.env.DB);
      return c.json(apartments);
    } else {
      // User sees only their apartment
      const apartment = await getApartmentByUserId(c.env.DB, user.id);
      if (apartment) {
        return c.json([apartment]);
      } else {
        return c.json([]);
      }
    }
  } catch (err) {
    console.error('Get apartments error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja stanova' }, 500);
  }
});

/**
 * GET /api/apartments/:id
 * Get apartment details
 */
app.get('/:id', authenticate, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    if (!isInteger(id) || id < 1) {
      return c.json({ error: 'Nevazeci ID stana' }, 400);
    }

    const apartment = await getApartmentById(c.env.DB, id);

    if (!apartment) {
      return c.json({ error: 'Stan nije pronadjen' }, 404);
    }

    const user = c.get('user');

    // Non-admin can only view their own apartment
    if (!user.is_admin && apartment.user_id !== user.id) {
      return c.json({ error: 'Nemate dozvolu za pristup ovom stanu' }, 403);
    }

    return c.json(apartment);
  } catch (err) {
    console.error('Get apartment error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja stana' }, 500);
  }
});

/**
 * POST /api/apartments
 * Create new apartment (admin only)
 */
app.post('/', authenticate, requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { apartment_number, owner_name, floor_number, override_amount, user_id } = body;

    // Validate input
    const errors = [];

    if (!isValidApartmentNumber(apartment_number)) {
      errors.push({ field: 'apartment_number', message: 'Broj stana mora biti izmedju 1 i 99' });
    }

    if (!owner_name || !isNotEmpty(owner_name)) {
      errors.push({ field: 'owner_name', message: 'Ime vlasnika je obavezno' });
    } else if (owner_name.length > 200) {
      errors.push({ field: 'owner_name', message: 'Ime vlasnika ne moze biti duze od 200 karaktera' });
    }

    if (!isInteger(floor_number)) {
      errors.push({ field: 'floor_number', message: 'Sprat je obavezan' });
    } else if (floor_number < -5 || floor_number > 100) {
      errors.push({ field: 'floor_number', message: 'Nevazeci broj sprata' });
    }

    if (override_amount !== undefined && override_amount !== null && !isNonNegativeNumber(override_amount)) {
      errors.push({ field: 'override_amount', message: 'Iznos mora biti pozitivan broj' });
    }

    if (user_id !== undefined && user_id !== null && (!isInteger(user_id) || user_id < 1)) {
      errors.push({ field: 'user_id', message: 'Nevazeci ID korisnika' });
    }

    if (errors.length > 0) {
      return validationError(c, errors);
    }

    // Check if apartment number already exists
    const existing = await getApartmentByNumber(c.env.DB, parseInt(apartment_number, 10));
    if (existing) {
      return c.json({ error: 'Stan sa ovim brojem vec postoji' }, 400);
    }

    // Verify user exists if provided
    if (user_id) {
      const userExists = await getUserById(c.env.DB, user_id);
      if (!userExists) {
        return c.json({ error: 'Korisnik sa navedenim ID ne postoji' }, 400);
      }
    }

    // Insert apartment
    const result = await insertApartment(
      c.env.DB,
      parseInt(apartment_number, 10),
      owner_name.trim(),
      parseInt(floor_number, 10),
      override_amount ? parseFloat(override_amount) : null,
      user_id || null
    );

    // Return created apartment
    const apartment = await getApartmentById(c.env.DB, result.meta.last_row_id);
    return c.json(apartment, 201);
  } catch (err) {
    console.error('Create apartment error:', err);
    return c.json({ error: 'Greska prilikom kreiranja stana' }, 500);
  }
});

/**
 * PUT /api/apartments/:id
 * Update apartment (admin only)
 */
app.put('/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    if (!isInteger(id) || id < 1) {
      return c.json({ error: 'Nevazeci ID stana' }, 400);
    }

    const body = await c.req.json();
    const { apartment_number, owner_name, floor_number, override_amount, user_id } = body;

    // Validate input
    const errors = [];

    if (!isValidApartmentNumber(apartment_number)) {
      errors.push({ field: 'apartment_number', message: 'Broj stana mora biti izmedju 1 i 99' });
    }

    if (!owner_name || !isNotEmpty(owner_name)) {
      errors.push({ field: 'owner_name', message: 'Ime vlasnika je obavezno' });
    } else if (owner_name.length > 200) {
      errors.push({ field: 'owner_name', message: 'Ime vlasnika ne moze biti duze od 200 karaktera' });
    }

    if (!isInteger(floor_number)) {
      errors.push({ field: 'floor_number', message: 'Sprat je obavezan' });
    } else if (floor_number < -5 || floor_number > 100) {
      errors.push({ field: 'floor_number', message: 'Nevazeci broj sprata' });
    }

    if (override_amount !== undefined && override_amount !== null && !isNonNegativeNumber(override_amount)) {
      errors.push({ field: 'override_amount', message: 'Iznos mora biti pozitivan broj' });
    }

    if (user_id !== undefined && user_id !== null && (!isInteger(user_id) || user_id < 1)) {
      errors.push({ field: 'user_id', message: 'Nevazeci ID korisnika' });
    }

    if (errors.length > 0) {
      return validationError(c, errors);
    }

    // Check apartment exists
    const apartment = await getApartmentById(c.env.DB, id);
    if (!apartment) {
      return c.json({ error: 'Stan nije pronadjen' }, 404);
    }

    // Check if apartment number already exists (different apartment)
    const existing = await getApartmentByNumber(c.env.DB, parseInt(apartment_number, 10));
    if (existing && existing.id !== id) {
      return c.json({ error: 'Stan sa ovim brojem vec postoji' }, 400);
    }

    // Verify user exists if provided
    if (user_id) {
      const userExists = await getUserById(c.env.DB, user_id);
      if (!userExists) {
        return c.json({ error: 'Korisnik sa navedenim ID ne postoji' }, 400);
      }
    }

    // Update apartment
    await updateApartment(
      c.env.DB,
      id,
      parseInt(apartment_number, 10),
      owner_name.trim(),
      parseInt(floor_number, 10),
      override_amount ? parseFloat(override_amount) : null,
      user_id || null
    );

    // Return updated apartment
    const updated = await getApartmentById(c.env.DB, id);
    return c.json(updated);
  } catch (err) {
    console.error('Update apartment error:', err);
    return c.json({ error: 'Greska prilikom azuriranja stana' }, 500);
  }
});

/**
 * DELETE /api/apartments/:id
 * Delete apartment (admin only)
 */
app.delete('/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    if (!isInteger(id) || id < 1) {
      return c.json({ error: 'Nevazeci ID stana' }, 400);
    }

    // Check apartment exists
    const apartment = await getApartmentById(c.env.DB, id);
    if (!apartment) {
      return c.json({ error: 'Stan nije pronadjen' }, 404);
    }

    // Delete apartment (cascade deletes billings and payments)
    await deleteApartment(c.env.DB, id);

    return c.json({ message: 'Stan je uspesno obrisan' });
  } catch (err) {
    console.error('Delete apartment error:', err);
    return c.json({ error: 'Greska prilikom brisanja stana' }, 500);
  }
});

export default app;
