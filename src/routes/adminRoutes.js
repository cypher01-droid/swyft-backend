// src/routes/adminRoutes.js
const express = require("express");
const router = express.Router();

const {
  getAdminDashboard,
  getPendingDeposits,
  approveDeposit,
  rejectDeposit,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getPendingKYC,
  approveKYC,
  rejectKYC,
  getPendingLoans,
  approveLoan,
  rejectLoan
} = require("../controllers/adminController");

const { verifyAdmin } = require("../middleware/adminAuth");

// DASHBOARD
router.get("/dashboard", verifyAdmin, getAdminDashboard);

// DEPOSITS
router.get("/deposits/pending", verifyAdmin, getPendingDeposits);
router.post("/deposits/:id/approve", verifyAdmin, approveDeposit);
router.post("/deposits/:id/reject", verifyAdmin, rejectDeposit);

// WITHDRAWALS
router.get("/withdrawals/pending", verifyAdmin, getPendingWithdrawals);
router.post("/withdrawals/:id/approve", verifyAdmin, approveWithdrawal);
router.post("/withdrawals/:id/reject", verifyAdmin, rejectWithdrawal);

// KYC
router.get("/kyc/pending", verifyAdmin, getPendingKYC);
router.post("/kyc/:uid/approve", verifyAdmin, approveKYC);
router.post("/kyc/:uid/reject", verifyAdmin, rejectKYC);

// LOANS
router.get("/loans/pending", verifyAdmin, getPendingLoans);
router.post("/loans/:id/approve", verifyAdmin, approveLoan);
router.post("/loans/:id/reject", verifyAdmin, rejectLoan);

module.exports = router;
