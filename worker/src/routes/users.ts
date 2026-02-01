import { Hono } from 'hono';
import { hash } from 'bcryptjs';
import type { Env } from '../types';
import {
  getAllUsers,
  getUserById,
  getUserByEmail,
  insertUser,
  updateUser,
  updateUserPassword,
  deleteUser,
} from '../db/queries';
import { authenticate, requireAdmin, checkAdminOrSelf } from '../middleware/auth';
import {
  validationError,
  isNotEmpty,
  isValidEmail,
  isStrongPassword,
  isInteger,
} from '../middleware/validation';

const app = new Hono<{ Bindings: Env }>();
const SALT_ROUNDS = 10;

/**
 * GET /api/users
 * List all users (admin only)
 */
app.get('/', authenticate, requireAdmin, async (c) => {
  try {
    const users = await getAllUsers(c.env.DB);
    return c.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja korisnika' }, 500);
  }
});

/**
 * GET /api/users/:id
 * Get user details (admin or self)
 */
app.get('/:id', authenticate, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    if (!isInteger(id) || id < 1) {
      return c.json({ error: 'Nevazeci ID korisnika' }, 400);
    }

    // Check permissions
    const authCheck = checkAdminOrSelf(c, id);
    if (authCheck) return authCheck;

    const user = await getUserById(c.env.DB, id);

    if (!user) {
      return c.json({ error: 'Korisnik nije pronadjen' }, 404);
    }

    // Don't return password hash
    const { password_hash, ...userData } = user;
    return c.json(userData);
  } catch (err) {
    console.error('Get user error:', err);
    return c.json({ error: 'Greska prilikom ucitavanja korisnika' }, 500);
  }
});

/**
 * POST /api/users
 * Create new user (admin only)
 */
app.post('/', authenticate, requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, is_admin = false, is_user = true } = body;

    // Validate input
    const errors = [];

    if (!email || !isNotEmpty(email)) {
      errors.push({ field: 'email', message: 'Email je obavezan' });
    } else if (!isValidEmail(email)) {
      errors.push({ field: 'email', message: 'Nevazeci format email adrese' });
    }

    if (!password || !isNotEmpty(password)) {
      errors.push({ field: 'password', message: 'Lozinka je obavezna' });
    } else if (!isStrongPassword(password)) {
      errors.push({
        field: 'password',
        message: 'Lozinka mora imati najmanje 8 karaktera, jedno veliko slovo, jedno malo slovo i jedan broj',
      });
    }

    if (!name || !isNotEmpty(name)) {
      errors.push({ field: 'name', message: 'Ime je obavezno' });
    } else if (name.length > 200) {
      errors.push({ field: 'name', message: 'Ime ne moze biti duze od 200 karaktera' });
    }

    if (errors.length > 0) {
      return validationError(c, errors);
    }

    // Check if email already exists
    const existing = await getUserByEmail(c.env.DB, email.toLowerCase());
    if (existing) {
      return c.json({ error: 'Korisnik sa ovom email adresom vec postoji' }, 400);
    }

    // Hash password
    const passwordHash = await hash(password, SALT_ROUNDS);

    // Insert user
    const result = await insertUser(
      c.env.DB,
      email.toLowerCase(),
      passwordHash,
      name.trim(),
      is_admin ? 1 : 0,
      is_user ? 1 : 0
    );

    // Return created user (without password)
    const user = await getUserById(c.env.DB, result.meta.last_row_id);
    if (user) {
      const { password_hash, ...userData } = user;
      return c.json(userData, 201);
    }

    return c.json({ error: 'Greska prilikom kreiranja korisnika' }, 500);
  } catch (err) {
    console.error('Create user error:', err);
    return c.json({ error: 'Greska prilikom kreiranja korisnika' }, 500);
  }
});

/**
 * PUT /api/users/:id
 * Update user (admin or self for limited fields)
 */
app.put('/:id', authenticate, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    if (!isInteger(id) || id < 1) {
      return c.json({ error: 'Nevazeci ID korisnika' }, 400);
    }

    const body = await c.req.json();
    const { email, name, password, is_admin, is_user } = body;

    // Validate input
    const errors = [];

    if (!email || !isNotEmpty(email)) {
      errors.push({ field: 'email', message: 'Email je obavezan' });
    } else if (!isValidEmail(email)) {
      errors.push({ field: 'email', message: 'Nevazeci format email adrese' });
    }

    if (!name || !isNotEmpty(name)) {
      errors.push({ field: 'name', message: 'Ime je obavezno' });
    } else if (name.length > 200) {
      errors.push({ field: 'name', message: 'Ime ne moze biti duze od 200 karaktera' });
    }

    if (password && !isStrongPassword(password)) {
      errors.push({
        field: 'password',
        message: 'Lozinka mora imati najmanje 8 karaktera, jedno veliko slovo, jedno malo slovo i jedan broj',
      });
    }

    if (errors.length > 0) {
      return validationError(c, errors);
    }

    // Check user exists
    const user = await getUserById(c.env.DB, id);
    if (!user) {
      return c.json({ error: 'Korisnik nije pronadjen' }, 404);
    }

    const currentUser = c.get('user');
    const isSelf = currentUser.id === id;
    const isAdmin = Boolean(currentUser.is_admin);

    if (!isAdmin && !isSelf) {
      return c.json({ error: 'Nemate dozvolu za izmenu ovog korisnika' }, 403);
    }

    // Non-admin can only change their own name and password
    if (!isAdmin && isSelf) {
      // Update password if provided
      if (password) {
        const passwordHash = await hash(password, SALT_ROUNDS);
        await updateUserPassword(c.env.DB, id, passwordHash);
      }

      // Update name only (keep original email and roles)
      await updateUser(c.env.DB, id, user.email, name.trim(), user.is_admin, user.is_user);

      const updated = await getUserById(c.env.DB, id);
      if (updated) {
        const { password_hash, ...userData } = updated;
        return c.json(userData);
      }
    }

    // Admin can change everything
    // Check if email already exists (different user)
    const existing = await getUserByEmail(c.env.DB, email.toLowerCase());
    if (existing && existing.id !== id) {
      return c.json({ error: 'Korisnik sa ovom email adresom vec postoji' }, 400);
    }

    // Prevent removing last admin
    if (user.is_admin && is_admin === false) {
      const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').first<{
        count: number;
      }>();
      if (result && result.count <= 1) {
        return c.json({ error: 'Ne mozete ukloniti poslednjeg administratora' }, 400);
      }
    }

    // Update user
    await updateUser(
      c.env.DB,
      id,
      email.toLowerCase(),
      name.trim(),
      is_admin !== undefined ? (is_admin ? 1 : 0) : user.is_admin,
      is_user !== undefined ? (is_user ? 1 : 0) : user.is_user
    );

    // Update password if provided
    if (password) {
      const passwordHash = await hash(password, SALT_ROUNDS);
      await updateUserPassword(c.env.DB, id, passwordHash);
    }

    // Return updated user
    const updated = await getUserById(c.env.DB, id);
    if (updated) {
      const { password_hash, ...userData } = updated;
      return c.json(userData);
    }

    return c.json({ error: 'Greska prilikom azuriranja korisnika' }, 500);
  } catch (err) {
    console.error('Update user error:', err);
    return c.json({ error: 'Greska prilikom azuriranja korisnika' }, 500);
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
app.delete('/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    if (!isInteger(id) || id < 1) {
      return c.json({ error: 'Nevazeci ID korisnika' }, 400);
    }

    // Check user exists
    const user = await getUserById(c.env.DB, id);
    if (!user) {
      return c.json({ error: 'Korisnik nije pronadjen' }, 404);
    }

    const currentUser = c.get('user');

    // Prevent deleting self
    if (currentUser.id === id) {
      return c.json({ error: 'Ne mozete obrisati sopstveni nalog' }, 400);
    }

    // Prevent deleting last admin
    if (user.is_admin) {
      const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').first<{
        count: number;
      }>();
      if (result && result.count <= 1) {
        return c.json({ error: 'Ne mozete obrisati poslednjeg administratora' }, 400);
      }
    }

    // Delete user
    await deleteUser(c.env.DB, id);

    return c.json({ message: 'Korisnik je uspesno obrisan' });
  } catch (err) {
    console.error('Delete user error:', err);
    return c.json({ error: 'Greska prilikom brisanja korisnika' }, 500);
  }
});

export default app;
