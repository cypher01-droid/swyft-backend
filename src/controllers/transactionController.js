// src/controllers/transactionController.js
const { db, admin } = require('../config/firebase');
const zod = require('zod'); // For 2026 input validation

// Schema for input validation (prevents API attacks)
const transactionSchema = zod.object({
  amount: zod.number().positive(),
  currency: zod.string().min(2).max(5),
  method: zod.string().optional(),
  recipient: zod.string().optional()
});

// --- DEPOSIT REQUEST ---
const requestDeposit = async (req, res) => {
  try {
    const { amount, methodType, currency, network } = req.body;
    const uid = req.user.uid;

    // Admin payment details (Keep these on the server for security!)
    const paymentInstructions = {
      'BTC_BTC': { address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", currency: "BTC" },
      'ETH_ERC20': { address: "0xYourEthAddressHere", currency: "ETH" },
      'USD_ZELLE': { instructions: "Zelle: admin@nexusbank.com", method: "Zelle" }
    };

    const selectedDetails = paymentInstructions[network] || paymentInstructions['USD_ZELLE'];

    // Create record in Firestore
    const txRef = db.collection('transactions').doc();
    await txRef.set({
      uid: uid,
      type: 'Deposit',
      amount: parseFloat(amount),
      currency: currency,
      status: 'Pending',
      createdAt: new Date(),
      trackingCode: `DEP-${Math.random().toString(36).toUpperCase().slice(2, 8)}`
    });

    res.json({
      adminDetails: { ...selectedDetails, amount }
    });
  } catch (error) {
    res.status(500).json({ error: "Deposit failed" });
  }
};
// --- WITHDRAWAL REQUEST --- (Includes the 'Available Balance' check)
// --- USER WITHDRAW REQUEST ---
const requestWithdrawal = async (req, res) => {
  try {
    const { amount, method, details, currency = 'USD' } = req.body;
    const uid = req.user.uid;

    if (!amount || amount <= 0 || !method || !details) {
      return res.status(400).json({ error: 'Invalid withdrawal data' });
    }

    const balanceRef = db
      .collection('accounts')
      .doc(uid)
      .collection('balances')
      .doc(currency);

    await db.runTransaction(async (t) => {
      const balanceSnap = await t.get(balanceRef);

      if (!balanceSnap.exists) {
        throw new Error('Balance not found');
      }

      const { available = 0, pending = 0 } = balanceSnap.data();

      if (available < amount) {
        throw new Error('Insufficient balance');
      }

      // Lock funds
      t.update(balanceRef, {
        available: available - amount,
        pending: pending + amount
      });

      const txRef = db.collection('transactions').doc();
      t.set(txRef, {
        id: txRef.id,
        uid,
        type: 'Withdrawal',
        method,
        details,
        amount,
        currency,
        status: 'Pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    res.status(201).json({
      message: 'Withdrawal request submitted',
      reference: `WDR-${Date.now()}`
    });

  } catch (error) {
    console.error('Withdrawal error:', error.message);
    res.status(400).json({ error: error.message });
  }
};
const swapAssets = async (req, res) => {
  try {
    const { fromAsset, toAsset, amount } = req.body;
    const uid = req.user.uid;

    if (!fromAsset || !toAsset || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid swap data' });
    }

    const fromRef = db.collection('accounts').doc(uid).collection('balances').doc(fromAsset);
    const toRef = db.collection('accounts').doc(uid).collection('balances').doc(toAsset);

    await db.runTransaction(async (t) => {
      const fromSnap = await t.get(fromRef);
      const toSnap = await t.get(toRef);

      if (!fromSnap.exists || !toSnap.exists) {
        throw new Error('Asset balance not found');
      }

      const fromData = fromSnap.data();
      const toData = toSnap.data();

      if (fromData.available < amount) {
        throw new Error('Insufficient balance');
      }

      const rate = fromData.rate / toData.rate;
      const receivedAmount = amount * rate;

      t.update(fromRef, {
        available: fromData.available - amount
      });

      t.update(toRef, {
        available: (toData.available || 0) + receivedAmount
      });

      const txRef = db.collection('transactions').doc();
      t.set(txRef, {
        id: txRef.id,
        uid,
        type: 'Swap',
        fromAsset,
        toAsset,
        amount,
        receivedAmount,
        status: 'Completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    res.json({ message: 'Swap completed successfully' });

  } catch (err) {
    console.error('Swap Error:', err.message);
    res.status(400).json({ error: err.message });
  }
};

/**
 * ============================
 * SEND ASSET (USER)
 * ============================
 */
const sendAsset = async (req, res) => {
  try {
    const { asset, amount, recipient } = req.body;
    const uid = req.user.uid;

    if (!asset || !amount || !recipient) {
      return res.status(400).json({ error: 'Invalid transfer data' });
    }

    const assetRef = db.collection('accounts').doc(uid).collection('balances').doc(asset);

    await db.runTransaction(async (t) => {
      const snap = await t.get(assetRef);
      if (!snap.exists) throw new Error('Asset not found');

      const data = snap.data();
      if (data.available < amount) throw new Error('Insufficient balance');

      t.update(assetRef, {
        available: data.available - amount
      });

      const txRef = db.collection('transactions').doc();
      t.set(txRef, {
        id: txRef.id,
        uid,
        type: 'Send',
        asset,
        amount,
        recipient,
        status: 'Pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    res.json({ message: 'Transfer submitted' });

  } catch (err) {
    console.error('Send Error:', err.message);
    res.status(400).json({ error: err.message });
  }
};
// You can add the swap logic here later...
const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.uid;
    const status = req.query.status;

    let query = db
      .collection('transactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50);

    if (status && status !== 'All') {
      query = query.where('status', '==', status);
    }

    const snap = await query.get();
    const transactions = [];

    snap.forEach(doc => {
      const d = doc.data();
      transactions.push({
        id: doc.id,
        type: d.type,
        amount: d.amount,
        asset: d.asset,
        status: d.status,
        method: d.method,
        date: d.createdAt.toDate().toLocaleDateString()
      });
    });

    res.json({ transactions });

  } catch (err) {
    console.error('Transaction fetch error:', err);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
};

const trackRefund = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Tracking code required' });
    }

    const snap = await db
      .collection('refunds')
      .where('code', '==', code.toUpperCase())
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ error: 'Refund not found' });
    }

    const refund = snap.docs[0].data();

    res.json({
      code: refund.code,
      amount: refund.amount.toLocaleString(),
      currency: refund.currency,
      currentStage: refund.currentStage,
      stages: refund.stages,
      lastUpdate: refund.lastUpdate
    });

  } catch (err) {
    console.error('Refund Tracking Error:', err);
    res.status(500).json({ error: 'Failed to track refund' });
  }
};

const requestLoan = async (req, res) => {
  try {
    const uid = req.user.uid;

    const {
      loanType,
      amount,
      monthlyIncome,
      businessReg,
      annualRevenue,
      vehicle,
      vehicleCondition,
      propertyAddress,
      downPayment
    } = req.body;

    if (!loanType || !amount || !monthlyIncome) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const refCode = `LN-${Math.floor(10000 + Math.random() * 90000)}`;

    const loanData = {
      uid,
      loanType,
      amount: Number(amount),
      monthlyIncome: Number(monthlyIncome),
      status: 'pending',
      refCode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),

      // optional fields
      businessReg: businessReg || null,
      annualRevenue: annualRevenue || null,
      vehicle: vehicle || null,
      vehicleCondition: vehicleCondition || null,
      propertyAddress: propertyAddress || null,
      downPayment: downPayment || null
    };

    await db.collection('loanRequests').add(loanData);

    res.status(201).json({
      success: true,
      refCode
    });

  } catch (error) {
    console.error('Loan request error:', error);
    res.status(500).json({ message: 'Failed to submit loan request' });
  }
};

const checkStatus = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ error: "Reference code required" });
    }

    let collection = null;

    if (code.startsWith("RF-")) collection = "refunds";
    if (code.startsWith("LN-")) collection = "loans";

    if (!collection) {
      return res.status(404).json({ error: "Invalid reference code" });
    }

    const snapshot = await db
      .collection(collection)
      .where("referenceCode", "==", code)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "Record not found" });
    }

    const data = snapshot.docs[0].data();

    res.json({
      type: collection === "refunds" ? "Refund" : "Loan",
      status: data.status,
      currentStage: data.currentStage,
      stages: data.stages,
      updatedAt: data.updatedAt,
    });
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { 
  requestDeposit,
   requestWithdrawal, 
   swapAssets, 
   sendAsset, 
   getUserTransactions, 
   trackRefund,
  requestLoan, 
  checkStatus };
