const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  getUserDashboard, 
  getHeaderData, 
  getUserProfile, 
  requestDeposit,
  submitKYC,
  getMyKYCStatus, 
  getUserStats  
} = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');

// 1. Register - Protected by verifyToken to ensure UID integrity
// If you want it public, keep it as is, but verifyToken is safer for ledger apps
router.post('/register', verifyToken, registerUser); 

// 2. Authenticated Data Routes
router.get('/dashboard', verifyToken, getUserDashboard);
router.get('/header', verifyToken, getHeaderData);
router.get('/profile', verifyToken, getUserProfile);
router.get('/stats', verifyToken, getUserStats);

// 3. Action Routes
router.post('/deposit', verifyToken, requestDeposit);
router.post('/submit', verifyToken, submitKYC);
router.get('/me', verifyToken, getMyKYCStatus);

module.exports = router;
