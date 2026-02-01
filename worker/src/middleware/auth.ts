import { Context, Next } from 'hono';
import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose';
import type { Env, JWTPayload, UserPublic } from '../types';
import { getUserById } from '../db/queries';

// Secret key encoder
function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Generate JWT token for user
 */
export async function generateToken(user: UserPublic, env: Env): Promise<string> {
  const secret = getSecretKey(env.JWT_SECRET);
  const expiresIn = env.JWT_EXPIRES_IN || '24h';

  // Parse expiry time
  const expirySeconds = parseExpiry(expiresIn);

  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    is_admin: user.is_admin,
    is_user: user.is_user,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirySeconds)
    .sign(secret);

  return token;
}

/**
 * Parse expiry string to seconds (e.g., "24h" -> 86400)
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 86400; // Default 24h

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 86400;
  }
}

/**
 * Verify JWT token
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload> {
  const secretKey = getSecretKey(secret);
  const { payload } = await jwtVerify(token, secretKey);
  return payload as unknown as JWTPayload;
}

/**
 * Extract token from request headers
 */
function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Extend Context with user property
declare module 'hono' {
  interface ContextVariableMap {
    user: UserPublic;
  }
}

/**
 * Authentication middleware for Hono
 * Requires valid JWT token
 */
export async function authenticate(c: Context<{ Bindings: Env }>, next: Next) {
  const token = extractToken(c);

  if (!token) {
    return c.json({ error: 'Autentifikacija je obavezna' }, 401);
  }

  try {
    const decoded = await verifyToken(token, c.env.JWT_SECRET);

    // Get fresh user data from database
    const user = await getUserById(c.env.DB, decoded.id);

    if (!user) {
      return c.json({ error: 'Korisnik nije pronadjen' }, 401);
    }

    // Set user in context
    c.set('user', {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      is_user: user.is_user,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });

    await next();
  } catch (err) {
    if (err instanceof Error && err.message.includes('exp')) {
      return c.json({ error: 'Sesija je istekla. Prijavite se ponovo.' }, 401);
    }
    return c.json({ error: 'Nevazeci token' }, 401);
  }
}

/**
 * Require admin role middleware
 * Must be used after authenticate middleware
 */
export async function requireAdmin(c: Context<{ Bindings: Env }>, next: Next) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Autentifikacija je obavezna' }, 401);
  }

  if (!user.is_admin) {
    return c.json({ error: 'Pristup dozvoljen samo administratorima' }, 403);
  }

  await next();
}

/**
 * Require user role middleware
 * Must be used after authenticate middleware
 */
export async function requireUser(c: Context<{ Bindings: Env }>, next: Next) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Autentifikacija je obavezna' }, 401);
  }

  if (!user.is_user) {
    return c.json({ error: 'Pristup nije dozvoljen' }, 403);
  }

  await next();
}

/**
 * Check if current user is admin or owns the resource
 */
export function isAdminOrSelf(c: Context<{ Bindings: Env }>, resourceUserId: number): boolean {
  const user = c.get('user');
  if (!user) return false;
  return Boolean(user.is_admin) || user.id === resourceUserId;
}

/**
 * Require admin or self access - returns error response if not authorized
 */
export function checkAdminOrSelf(
  c: Context<{ Bindings: Env }>,
  resourceUserId: number
): Response | null {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Autentifikacija je obavezna' }, 401);
  }

  if (!user.is_admin && user.id !== resourceUserId) {
    return c.json({ error: 'Nemate dozvolu za pristup ovom resursu' }, 403);
  }

  return null; // Authorized
}
