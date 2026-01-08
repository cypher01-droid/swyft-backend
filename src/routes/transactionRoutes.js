// src/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { requestDeposit, requestWithdrawal, swapAssets, sendAsset , getUserTransactions, trackRefund , requestLoan, checkStatus} = require('../controllers/transactionController');
const { verifyToken } = require('../middleware/auth');

// All transaction requests require a valid user token
router.post('/deposit', verifyToken, requestDeposit);
router.post('/withdraw', verifyToken, requestWithdrawal);
router.post('/swap', verifyToken, swapAssets);
router.post('/send', verifyToken, sendAsset);
router.get('/history', verifyToken, getUserTransactions);
router.get('/track', verifyToken, trackRefund);
router.post('/request', verifyToken, requestLoan);
router.get("/status/:code", checkStatus);

module.exports = router;
