import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db/azureSql.js';

const router = Router();
const SECRET = process.env.JWT_SECRET;

// ─── LOGIN ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, identifier, password } = req.body;
    const id = username || identifier;

    if (!id || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await query(
      `SELECT id, name, username, email, password, role 
       FROM users 
       WHERE username = @identifier OR email = @identifier`,
      { identifier: id }
    );

    const user = result?.recordset?.[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    if (!SECRET) {
      return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET is required' });
    }

    const token = jwt.sign(payload, SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: payload
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;