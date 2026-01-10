// src/middleware/auth.js
const admin = require('firebase-admin');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn("Auth Attempt Failed: No Bearer Token");
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // We use the admin global object directly to ensure it is initialized
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Attach the user info to the request object
    req.user = decodedToken; 
    
    next();
  } catch (error) {
    console.error('Firebase Token Verification Error:', error.code);

    // Provide specific feedback for expired tokens
    if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Session expired. Please refresh or login again.' });
    }

    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Optional: Add a second middleware for Admin-only routes
const verifyAdmin = async (req, res, next) => {
    if (!req.user || !req.user.admin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

module.exports = { verifyToken, verifyAdmin };
