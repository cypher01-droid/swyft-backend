// src/middleware/auth.js
const { auth } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  // 1. Get the token from the 'Authorization' header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // 2. Use Firebase Admin to verify the token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // 3. Attach the user info to the request object
    req.user = decodedToken; 
    
    // 4. Move to the next step (the controller)
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

module.exports = { verifyToken };
