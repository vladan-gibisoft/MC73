import { Hono } from 'hono';
import { compare } from 'bcryptjs';
import type { Env } from '../types';
import { getUserByEmail } from '../db/queries';
import { generateToken, authenticate } from '../middleware/auth';
import { validationError, isValidEmail, isNotEmpty } from '../middleware/validation';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/login
 * User login
 */
app.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    // Validate input
    const errors = [];
    if (!email || !isNotEmpty(email)) {
      errors.push({ field: 'email', message: 'Email je obavezan' });
    } else if (!isValidEmail(email)) {
      errors.push({ field: 'email', message: 'Nevazeci format email adrese' });
    }
    if (!password || !isNotEmpty(password)) {
      errors.push({ field: 'password', message: 'Lozinka je obavezna' });
    }

    if (errors.length > 0) {
      return validationError(c, errors);
    }

    // Find user by email
    const user = await getUserByEmail(c.env.DB, email.toLowerCase());

    if (!user) {
      return c.json({ error: 'Pogresna email adresa ili lozinka' }, 401);
    }

    // Verify password
    const isValidPassword = await compare(password, user.password_hash);

    if (!isValidPassword) {
      return c.json({ error: 'Pogresna email adresa ili lozinka' }, 401);
    }

    // Generate token
    const token = await generateToken(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: user.is_admin,
        is_user: user.is_user,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      c.env
    );

    // Return user info and token
    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: Boolean(user.is_admin),
        is_user: Boolean(user.is_user),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return c.json({ error: 'Greska prilikom prijave' }, 500);
  }
});

/**
 * POST /api/auth/logout
 * User logout (client-side token removal)
 */
app.post('/logout', (c) => {
  // Token removal happens client-side
  // This endpoint just confirms the logout
  return c.json({ message: 'Uspesno ste se odjavili' });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
app.get('/me', authenticate, (c) => {
  const user = c.get('user');
  return c.json({ user });
});

export default app;
