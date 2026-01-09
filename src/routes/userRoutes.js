// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
// Ensure curly braces are used here:
const { registerUser, getUserDashboard, getHeaderData, getUserProfile, requestDeposit,submitKYC,
  getMyKYCStatus, getUserStats  } = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');

// Line 8:
router.post('/register', registerUser); 
router.get('/dashboard', verifyToken, getUserDashboard); // Dashboard route
router.get('/header', verifyToken, getHeaderData);
router.get('/profile', verifyToken, getUserProfile);
router.post('/deposit', verifyToken, requestDeposit);
router.post('/submit', verifyToken, submitKYC);
router.get('/stats', auth, getUserStats);

// User checks own KYC status
router.get('/me', verifyToken, getMyKYCStatus);

module.exports = router;
