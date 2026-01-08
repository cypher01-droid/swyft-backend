const { db, admin } = require("../config/firebase");

const getAdminDashboard = async (req, res) => {
  try {
    const [deposits, withdrawals, kyc, loans] = await Promise.all([
      db.collection("transactions").where("type", "==", "Deposit").where("status", "==", "Pending").get(),
      db.collection("transactions").where("type", "==", "Withdrawal").where("status", "==", "Pending").get(),
      db.collection("kyc").where("status", "==", "pending").get(),
      db.collection("loanRequests").where("status", "==", "pending").get()
    ]);

    res.json({
      pendingDeposits: deposits.size,
      pendingWithdrawals: withdrawals.size,
      pendingKYC: kyc.size,
      pendingLoans: loans.size
    });
  } catch (err) {
    res.status(500).json({ error: "Admin dashboard failed" });
  }
};

const getPendingDeposits = async (req, res) => {
  const snap = await db
    .collection("transactions")
    .where("type", "==", "Deposit")
    .where("status", "==", "Pending")
    .orderBy("createdAt", "desc")
    .get();

  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

const approveDeposit = async (req, res) => {
  const txId = req.params.id;
  const adminId = req.admin.uid;

  await db.runTransaction(async t => {
    const txRef = db.collection("transactions").doc(txId);
    const txSnap = await t.get(txRef);

    if (!txSnap.exists) throw new Error("Transaction not found");

    const tx = txSnap.data();
    if (tx.status !== "Pending") throw new Error("Already processed");

    const balRef = db
      .collection("accounts")
      .doc(tx.uid)
      .collection("balances")
      .doc(tx.currency);

    const balSnap = await t.get(balRef);
    const available = balSnap.data()?.available || 0;

    t.update(balRef, { available: available + tx.amount });
    t.update(txRef, {
      status: "Completed",
      reviewedBy: adminId,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  res.json({ success: true });
};

const rejectDeposit = async (req, res) => {
  await db.collection("transactions").doc(req.params.id).update({
    status: "Rejected",
    adminNote: req.body.reason,
    reviewedBy: req.admin.uid,
    reviewedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  res.json({ rejected: true });
};

const getPendingWithdrawals = async (req, res) => {
  const snap = await db
    .collection("transactions")
    .where("type", "==", "Withdrawal")
    .where("status", "==", "Pending")
    .get();

  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

const approveWithdrawal = async (req, res) => {
  const txId = req.params.id;

  await db.runTransaction(async t => {
    const txRef = db.collection("transactions").doc(txId);
    const tx = (await t.get(txRef)).data();

    const balRef = db
      .collection("accounts")
      .doc(tx.uid)
      .collection("balances")
      .doc(tx.currency);

    const bal = (await t.get(balRef)).data();

    t.update(balRef, {
      pending: bal.pending - tx.amount
    });

    t.update(txRef, {
      status: "Completed",
      reviewedBy: req.admin.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  res.json({ approved: true });
};

const rejectWithdrawal = async (req, res) => {
  const txId = req.params.id;

  await db.runTransaction(async t => {
    const txRef = db.collection("transactions").doc(txId);
    const tx = (await t.get(txRef)).data();

    const balRef = db
      .collection("accounts")
      .doc(tx.uid)
      .collection("balances")
      .doc(tx.currency);

    const bal = (await t.get(balRef)).data();

    t.update(balRef, {
      available: bal.available + tx.amount,
      pending: bal.pending - tx.amount
    });

    t.update(txRef, {
      status: "Rejected",
      adminNote: req.body.reason,
      reviewedBy: req.admin.uid
    });
  });

  res.json({ rejected: true });
};

const getPendingKYC = async (req, res) => {
  const snap = await db.collection("kyc").where("status", "==", "pending").get();
  res.json(snap.docs.map(d => d.data()));
};

const approveKYC = async (req, res) => {
  const uid = req.params.uid;

  await db.collection("kyc").doc(uid).update({
    status: "approved",
    reviewedBy: req.admin.uid,
    reviewedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("users").doc(uid).update({ kycStatus: "Verified" });

  res.json({ approved: true });
};

const rejectKYC = async (req, res) => {
  const uid = req.params.uid;

  await db.collection("kyc").doc(uid).update({
    status: "rejected",
    adminNote: req.body.reason,
    reviewedBy: req.admin.uid
  });

  await db.collection("users").doc(uid).update({ kycStatus: "Rejected" });

  res.json({ rejected: true });
};

const getPendingLoans = async (req, res) => {
  const snap = await db.collection("loanRequests").where("status", "==", "pending").get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

const approveLoan = async (req, res) => {
  const loanRef = db.collection("loanRequests").doc(req.params.id);
  const loan = (await loanRef.get()).data();

  await db.runTransaction(async t => {
    const balRef = db
      .collection("accounts")
      .doc(loan.uid)
      .collection("balances")
      .doc("USD");

    const bal = (await t.get(balRef)).data();

    t.update(balRef, { available: bal.available + loan.amount });
    t.update(loanRef, { status: "approved", reviewedBy: req.admin.uid });
  });

  res.json({ approved: true });
};

const rejectLoan = async (req, res) => {
  await db.collection("loanRequests").doc(req.params.id).update({
    status: "rejected",
    adminNote: req.body.reason
  });

  res.json({ rejected: true });
};

module.exports = {
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
  }