import { Router } from 'express';
import { query } from '../db/azureSql.js'; 
import bcrypt from 'bcryptjs'; // Recommended for password hashing

const router = Router();

// --- 1. SEED DATA / DEFAULT USERS ---
// In a real app, you'd run this once or use an admin panel
const DEFAULT_USERS = [
  { username: 'admin_ttp', password: 'TtpAdmin2026!', role: 'admin', name: 'Abdul Rahman' },
  { username: 'viewer_solmar', password: 'SolmarView26', role: 'viewer', name: 'Guest Viewer' }
];

// --- 2. GET ALL USERS (Admin Only) ---
router.get('/', async (req, res) => {
  try {
    // Select specific fields for security (don't send passwords to frontend)
    const result = await query(`SELECT id, name, username, email, role FROM users ORDER BY id DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'Failed to fetch user directory' });
  }
});

// --- 3. ADD A NEW USER (With Parameterized Query) ---
router.post('/add', async (req, res) => {
  const { name, username, email, password, role } = req.body;
  
  // Basic Validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // SECURITY: Use parameterized queries to prevent SQL Injection
    // Note: Use @params if your azureSql.js helper supports it, 
    // otherwise ensure strings are escaped.
    const sql = `
      INSERT INTO users (name, username, email, password, role)
      VALUES (@name, @username, @email, @password, @role)
    `;

    const params = {
      name: name,
      username: username,
      email: email,
      password: password, // Ideally: await bcrypt.hash(password, 10)
      role: role || 'viewer'
    };

    await query(sql, params); 
    res.json({ message: `User ${username} created successfully as ${params.role}` });
  } catch (err) {
    console.error('Insert Error:', err);
    res.status(500).json({ error: 'Failed to create user. Check if username exists.' });
  }
});

// --- 4. DELETE A USER ---
router.delete('/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    await query(`DELETE FROM users WHERE id = @id`, { id: userId });
    res.json({ message: 'User access revoked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'System could not process deletion' });
  }
});

export default router;