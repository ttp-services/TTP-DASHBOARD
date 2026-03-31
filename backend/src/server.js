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

const app = express();
const PORT = process.env.PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173,https://ttp-services.github.io,https://ttp-services.github.io/TTP-DASHBOARD';
const allowedOrigins = corsOrigin.split(',').map(o => o.trim()).filter(Boolean);

// ─── SECURITY ─────────────────────────────────────────
app.use(helmet());
app.use(express.json());

// CORS – explicitly allow GitHub Pages + local dev and handle preflight.
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
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

// ─── GLOBAL ERROR ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});