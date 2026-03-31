import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

export function requireAuth(req, res, next) {
  if (!SECRET) {
    return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET is required' });
  }

  try {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = auth.split(' ')[1];

    const decoded = jwt.verify(token, SECRET);

    req.user = decoded;

    next();

  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}