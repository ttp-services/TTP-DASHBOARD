import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db/azureSql.js';
const router = Router();
const SECRET = process.env.JWT_SECRET;

// ─── LOGIN ──────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, identifier, password } = req.body;
    const id = username || identifier;
    if (!id || !password) return res.status(400).json({ error: 'Username and password required' });
    const result = await query(
      `SELECT id, name, username, email, password, role FROM users
       WHERE username = @identifier OR email = @identifier`,
      { identifier: id }
    );
    const user = result?.recordset?.[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    if (!SECRET) return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET is required' });
    const token = jwt.sign(payload, SECRET, { expiresIn: '30d' });
    res.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── USER MANAGEMENT ────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const r = await query(`SELECT id, name, username, email, role FROM users ORDER BY id ASC`);
    res.json(r.recordset || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/users', async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: 'Name, username and password required' });
    const hashed = await bcrypt.hash(password, 10);
    const r = await query(
      `INSERT INTO users (name, username, email, password, role)
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.username, INSERTED.email, INSERTED.role
       VALUES (@name, @username, @email, @pass, @role)`,
      { name, username, email: email||'', pass: hashed, role: role||'viewer' }
    );
    res.json(r.recordset[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const r = await query(
      `UPDATE users SET name=@name, email=@email, role=@role
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.username, INSERTED.email, INSERTED.role
       WHERE id=@id`,
      { name, email: email||'', role, id: parseInt(req.params.id) }
    );
    res.json(r.recordset[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await query(`DELETE FROM users WHERE id=@id`, { id: parseInt(req.params.id) });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

export default router;
