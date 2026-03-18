import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

function getUsers() {
  try {
    const path = join(__dirname, '../data/users.json');
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch { return []; }
}

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Credentials required' });
    const users = getUsers();
    const user = users.find(u => u.username === identifier || u.email === identifier);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password;
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { user: { id: user.id, name: user.name, email: user.email, username: user.username } },
      process.env.JWT_SECRET || 'ttp-secret-key',
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ttp-secret-key');
    res.json(decoded.user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
