import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

// Route imports
import authRoutes from './routes/auth';
import buildingRoutes from './routes/building';
import apartmentsRoutes from './routes/apartments';
import usersRoutes from './routes/users';
import billingsRoutes from './routes/billings';
import paymentsRoutes from './routes/payments';

// Create Hono app with environment bindings
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use(
  '/api/*',
  cors({
    origin: '*', // Allow all origins in development; restrict in production
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/building', buildingRoutes);
app.route('/api/apartments', apartmentsRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/billings', billingsRoutes);
app.route('/api/payments', paymentsRoutes);

// Catch-all for undefined API routes
app.all('/api/*', (c) => {
  return c.json({ error: 'API endpoint not found' }, 404);
});

// Error handling
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    { error: err.message || 'Internal server error' },
    500
  );
});

export default app;
