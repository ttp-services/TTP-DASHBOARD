import jwt from 'jsonwebtoken';

export function requireApiKey(req, res, next) {
  if (process.env.REQUIRE_API_KEY !== 'true') return next();
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireAuth(req, res, next) {
  // Allow export endpoint with token in query param
  if (req.path === '/export' && req.query.token) {
    try {
      const secret = process.env.JWT_SECRET || 'ttp-secret-key';
      const decoded = jwt.verify(req.query.token, secret);
      req.user = decoded.user;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = auth.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'ttp-secret-key';
    const decoded = jwt.verify(token, secret);
    req.user = decoded.user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
