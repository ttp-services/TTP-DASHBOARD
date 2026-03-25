import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db/azureSql.js';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'ttp-secret-key';

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Credentials required' });

    const result = await query(
      'SELECT id, name, username, email, password, role FROM users WHERE username = @identifier OR email = @identifier',
      { identifier }
    );
    const user = result?.recordset?.[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = user.password && user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password;
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role } },
      SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── ME ───────────────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, SECRET);
    res.json(decoded.user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ─── MIDDLEWARE: admin only ───────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, SECRET);
    if (decoded?.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.user = decoded.user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── GET ALL USERS ────────────────────────────────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, username, email, role FROM users ORDER BY id ASC'
    );
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── ADD USER ─────────────────────────────────────────────────────────────────
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username and password are required' });
    }

    // Check duplicate username
    const exists = await query(
      'SELECT id FROM users WHERE username = @username OR email = @email',
      { username, email: email || '' }
    );
    if (exists.recordset?.length) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (name, username, email, password, role)
       VALUES (@name, @username, @email, @password, @role)`,
      { name, username, email: email || '', password: hashed, role: role || 'viewer' }
    );

    // Return the new user
    const newUser = await query(
      'SELECT id, name, username, email, role FROM users WHERE username = @username',
      { username }
    );
    res.status(201).json(newUser.recordset?.[0] || { name, username, email, role });
  } catch (err) {
    console.error('Add user error:', err);
    res.status(500).json({ error: 'Failed to add user', details: err.message });
  }
});

// ─── UPDATE USER ──────────────────────────────────────────────────────────────
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    if (password && password.trim()) {
      // Update with new password
      const hashed = await bcrypt.hash(password, 10);
      await query(
        'UPDATE users SET name = @name, email = @email, role = @role, password = @password WHERE id = @id',
        { name, email: email || '', role: role || 'viewer', password: hashed, id: parseInt(id) }
      );
    } else {
      // Update without changing password
      await query(
        'UPDATE users SET name = @name, email = @email, role = @role WHERE id = @id',
        { name, email: email || '', role: role || 'viewer', id: parseInt(id) }
      );
    }

    const updated = await query(
      'SELECT id, name, username, email, role FROM users WHERE id = @id',
      { id: parseInt(id) }
    );
    res.json(updated.recordset?.[0] || { id, name, email, role });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// ─── DELETE USER ──────────────────────────────────────────────────────────────
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    if (decoded?.user?.id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await query('DELETE FROM users WHERE id = @id', { id: parseInt(id) });
    res.json({ success: true, message: `User ${id} deleted` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

export default router;
