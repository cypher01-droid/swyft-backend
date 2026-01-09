const { admin } = require('../config/firebase');

const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No admin token provided' });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    if (!decoded.admin) {
      return res.status(403).json({ error: 'Admin access denied' });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    console.error('Admin auth error:', err.message);
    res.status(401).json({ error: 'Invalid admin token' });
  }
};

module.exports = { verifyAdmin };
