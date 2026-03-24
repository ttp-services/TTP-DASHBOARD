import { Router } from 'express';
import { query } from '../db/azureSql.js'; // Ensure this matches your DB helper path

const router = Router();

// 1. Get all users (Admin Only)
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT id, name, email, role FROM users`);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 2. Add a new user
router.post('/add', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    await query(`
      INSERT INTO users (name, email, password, role)
      VALUES ('${name}', '${email}', '${password}', '${role || 'viewer'}')
    `);
    res.json({ message: 'User added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// 3. Delete a user
router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM users WHERE id = ${req.params.id}`);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;