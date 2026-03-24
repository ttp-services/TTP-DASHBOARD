import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requireAuth } from './middleware/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
// 1. New User Management Route Import
import userRoutes from './routes/users.js';

const app = express();
const PORT = process.env.PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = corsOrigin.split(',').map(o => o.trim());

// Security & Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 200, 
  message: { error: 'Too many requests' } 
});
app.use('/api', limiter);

// ── API ROUTES ──────────────────────────────────────────────────────────────

// Public Routes
app.use('/api/auth', authRoutes);

// Protected Routes (Require Token)
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/ai', requireAuth, aiRoutes);

// 2. Register User Management (Protected)
app.use('/api/users', requireAuth, userRoutes);

// Health Check
app.get('/health', (req, res) => res.json({ 
  status: 'ok', 
  time: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
}));

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') return res.status(403).json({ error: 'Forbidden' });
  console.error('Server Error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 CORS allowed for: ${allowedOrigins.join(', ')}`);
});