import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { requireAuth } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';
// 1. New User Management Route Import
import userRoutes from './routes/users.js';
import { getPool } from './db/azureSql.js';

const app = express();
const PORT = process.env.PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173,https://ttp-services.github.io,https://ttp-services.github.io/TTP-DASHBOARD';
const allowedOrigins = corsOrigin.split(',').map(o => o.trim()).filter(Boolean);

// CORS – must be first middleware so proxies respect it
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser / same-origin requests (no Origin header)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Explicitly respond to OPTIONS preflight on all routes.
app.options('*', cors());

// Basic security & JSON parsing after CORS
app.use(helmet());
app.use(express.json());

// ─── RATE LIMIT ───────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 100
}));

// ─── ROUTES ───────────────────────────────────────────
app.use('/api/auth', authRoutes);

// Protected Routes (Require Token)
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/ai', requireAuth, aiRoutes);

// 2. Register User Management (Protected)
app.use('/api/users', requireAuth, userRoutes);

// ─── HEALTH ───────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
// Backwards-compatible health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Resilient DB init (non-blocking) ────────────────
async function initDb() {
  try {
    // Trigger pool creation once; failures must never prevent the API from starting.
    await getPool();
  } catch (e) {
    console.warn('DB not ready yet; continuing without blocking:', e?.message || e);
  }
}

// ─── GLOBAL ERROR ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  // Do not block the server from listening on DB startup delay/failure.
  initDb();
});