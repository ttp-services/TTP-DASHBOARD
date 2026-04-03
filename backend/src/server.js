import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';
import { getPool } from './db/azureSql.js';

const app = express();
const PORT = process.env.PORT || 8080;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173,https://ttp-services.github.io';
const allowedOrigins = corsOrigin.split(',').map(o => o.trim()).filter(Boolean);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// CORS — must be first
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());

app.use(helmet());
app.use(express.json());
app.set('trust proxy', 1);

app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 200 }));

// ── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/ai', requireAuth, aiRoutes);

// ── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('TTP Dashboard API is running'));
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── DB INIT ─────────────────────────────────────────────────────────────────
async function initDb() {
  try {
    await getPool();
    console.log('DB connected');
  } catch (e) {
    console.warn('DB not ready:', e?.message || e);
  }
}

// ── GLOBAL ERROR ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  initDb();
});
