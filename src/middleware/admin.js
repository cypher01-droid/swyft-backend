// src/middleware/admin.js

const verifyAdmin = (req, res, next) => {
  // In 2026, we check for a custom claim 'admin' or verify against a hardcoded UID
  // For your setup, replace 'YOUR_ADMIN_UID' with your actual Firebase UID
  const adminUID = "YOUR_ACTUAL_FIREBASE_UID_HERE"; 

  if (req.user && req.user.uid === adminUID) {
    next(); // Access granted
  } else {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

module.exports = { verifyAdmin };
