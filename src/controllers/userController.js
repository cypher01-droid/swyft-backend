const { db } = require('../config/firebase');

// 1. REGISTER USER & INITIALIZE LEDGER
const registerUser = async (req, res) => {
  try {
    const { uid, email, fullName, phone, kycDocs } = req.body;

    const userRef = db.collection('users').doc(uid);
    await userRef.set({
      fullName,
      email,
      phone,
      kycStatus: 'pending',
      kyc: {
        idDocument: kycDocs.idDocument,
        addressProof: kycDocs.addressProof,
        submittedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    });

    const balanceBatch = db.batch();
    ['USD', 'BTC', 'ETH', 'USDT'].forEach(currency => {
      const ref = db.collection('accounts').doc(uid).collection('balances').doc(currency);
      balanceBatch.set(ref, { available: 0, pending: 0 });
    });

    await balanceBatch.commit();
    res.status(201).json({ message: "Account & KYC references initialized." });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Failed to initialize user account." });
  }
};

// 2. GET DASHBOARD DATA (Balances & Recent Activity)

const getUserDashboard = async (req, res) => {
  try {
    const uid = req.user.uid;

    // 1️⃣ Fetch user profile
    const userDoc = await db.collection('users').doc(uid).get();
    
    // Fallback if user document is missing but auth exists
    const userData = userDoc.exists ? userDoc.data() : { fullName: "User" };

    // 2️⃣ Fetch balances with a guaranteed structure
    // We initialize this first so even if the DB is empty, the frontend won't crash
    let balances = {
      USD: { available: 0, pending: 0 },
      BTC: { available: 0, pending: 0 },
      ETH: { available: 0, pending: 0 },
      USDT: { available: 0, pending: 0 }
    };

    try {
      const balancesSnap = await db
        .collection('accounts')
        .doc(uid)
        .collection('balances')
        .get();

      if (!balancesSnap.empty) {
        balancesSnap.forEach(doc => {
          // Only overwrite if the currency exists in our default list
          if (balances[doc.id]) {
            balances[doc.id] = {
              available: Number(doc.data().available) || 0,
              pending: Number(doc.data().pending) || 0
            };
          }
        });
      }
    } catch (balError) {
      console.error('Non-critical: Failed to fetch balances collection', balError);
      // We don't throw here, so the frontend still gets the default 0 balances
    }

    // 3️⃣ Fetch recent transactions (last 5)
    let recentActivity = [];
    try {
      const txSnap = await db
        .collection('transactions')
        .where('uid', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      recentActivity = txSnap.docs.map(doc => {
        const tx = doc.data();
        return {
          id: doc.id,
          type: tx.type || 'Transaction',
          amount:
            tx.currency === 'USD'
              ? `$${Number(tx.amount || 0).toFixed(2)}`
              : `${tx.amount || 0} ${tx.currency || ''}`,
          currency: tx.currency || 'USD',
          method: tx.method || tx.network || tx.currency || 'System',
          status: tx.status || 'Pending'
        };
      });
    } catch (txError) {
      console.error('Non-critical: Failed to fetch transactions', txError);
      // Empty array is fine for the frontend
    }

    // 4️⃣ Final response - Guaranteed to have 'balances'
    return res.status(200).json({
      fullName: userData.fullName || 'User',
      balances: balances,
      recentActivity: recentActivity
    });

  } catch (error) {
    console.error('CRITICAL: Dashboard Load Failure:', error);
    // Even on a hard error, send the structure to prevent the "undefined" crash
    res.status(500).json({ 
      error: 'Internal Server Error',
      balances: { USD: { available: 0, pending: 0 } },
      recentActivity: [] 
    });
  }
};

// src/controllers/userController.js
const getHeaderData = async (req, res) => {
  try {
    const uid = req.user.uid;

    // Fetch user profile name
    const userDoc = await db.collection('users').doc(uid).get();
    
    // 🛡️ 2026 Check: Ensure notification query matches your index
    // This query is what usually triggers the 500 error if the index is missing
    const notifSnap = await db.collection('notifications')
      .where('uid', '==', uid)
      .where('status', '==', 'unread')
      .orderBy('createdAt', 'desc') // Sorting requires an index when used with 'where'
      .limit(1)
      .get();

    res.json({
      fullName: userDoc.data()?.fullName || "User Account",
      hasUnread: !notifSnap.empty
    });
  } catch (error) {
    console.error("!!! HEADER FETCH ERROR !!!", error.message);
    res.status(500).json({ error: error.message });
  }
};
const getUserProfile = async (req, res) => {
  try {
    const uid = req.user.uid;
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const data = userDoc.data();

    // 2026 Standard: Format data for the Profile UI
    res.status(200).json({
      name: data.fullName,
      email: data.email,
      phone: data.phone,
      tier: data.accountTier || "Gold Plus", // Default tier if not set
      kycStatus: data.kycStatus || "Unverified",
      joined: data.createdAt ? new Date(data.createdAt._seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "N/A",
      residence: data.residence || "Not Provided",
      accountId: `NEX-${uid.substring(0, 4).toUpperCase()}-001`,
      uploadedDocs: data.kyc ? [
        { name: "ID_Document_Front.jpg", status: data.kycStatus === 'Verified' ? 'Approved' : 'Pending' },
        { name: "Proof_of_Residence.pdf", status: data.kycStatus === 'Verified' ? 'Approved' : 'Pending' }
      ] : []
    });
  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
const requestDeposit = async (req, res) => {
  try {
    const { amount, methodType, currency, network } = req.body;
    const uid = req.user.uid;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    // 1. Define Admin Payment Details (Source of Truth)
    // In 2026, keep these on the server so you can update them easily
    const paymentInstructions = {
      'BTC_BTC': { address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", network: "Bitcoin (BTC)" },
      'ETH_ERC20': { address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", network: "Ethereum (ERC20)" },
      'USDT_TRC20': { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", network: "Tether (TRC20)" },
      'fiat': { instructions: "Check your email for Zelle/Wire instructions.", method: "Zelle/Wire" }
    };

    const selectedDetails = methodType === 'crypto' ? paymentInstructions[network] : paymentInstructions['fiat'];

    // 2. Create the PENDING transaction in Firestore
    const txRef = db.collection('transactions').doc();
    await txRef.set({
      uid: uid,
      type: 'Deposit',
      amount: parseFloat(amount),
      currency: currency || 'USD',
      method: methodType === 'crypto' ? network : 'Fiat',
      status: 'Pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      trackingCode: `DEP-${Math.random().toString(36).toUpperCase().slice(2, 8)}`
    });

    // 3. Return the instructions to the frontend
    res.status(201).json({
      message: "Request registered",
      adminDetails: {
        ...selectedDetails,
        amount: amount
      }
    });

  } catch (error) {
    console.error("Deposit Error:", error);
    res.status(500).json({ error: "Failed to initiate deposit" });
  }
};

const submitKYC = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { docType, frontUrl, backUrl, selfieUrl } = req.body;

    if (!docType || !frontUrl || !backUrl || !selfieUrl) {
      return res.status(400).json({ message: 'Missing KYC data' });
    }

    const kycRef = db.collection('kyc').doc(userId);

    await kycRef.set({
      userId,
      docType,
      status: 'pending',
      documents: {
        frontUrl,
        backUrl,
        selfieUrl
      },
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null
    });

    return res.status(201).json({
      message: 'KYC submitted successfully',
      status: 'pending'
    });

  } catch (error) {
    console.error('KYC submit error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get current user's KYC status
 */
const getMyKYCStatus = async (req, res) => {
  try {
    const userId = req.user.uid;

    const doc = await db.collection('kyc').doc(userId).get();

    if (!doc.exists) {
      return res.json({ status: 'unverified' });
    }

    return res.json(doc.data());

  } catch (error) {
    console.error('KYC status error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getUserStats = async (req, res) => {
  try {
    const uid = req.uid;
    const range = req.query.range || '90d';

    const days = range === '30d' ? 30 : 90;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const snap = await db
      .collection('transactions')
      .where('uid', '==', uid)
      .where('createdAt', '>=', fromDate)
      .get();

    let deposits = 0;
    let withdrawals = 0;
    let pending = 0;
    const allocation = {};
    const balanceHistory = [];

    snap.forEach(doc => {
      const tx = doc.data();

      if (!allocation[tx.asset]) allocation[tx.asset] = 0;

      if (tx.status === 'Completed') {
        if (tx.type === 'Deposit') deposits += tx.amount;
        if (tx.type === 'Withdraw') withdrawals += tx.amount;
      }

      if (tx.status === 'Pending') pending += tx.amount;

      if (tx.type !== 'Withdraw') allocation[tx.asset] += tx.amount;
      else allocation[tx.asset] -= tx.amount;

      balanceHistory.push({
        date: tx.createdAt.toDate().toISOString().split('T')[0],
        balance: tx.balanceAfter || 0
      });
    });

    res.json({
      balanceHistory,
      deposits,
      withdrawals,
      allocation,
      available: deposits - withdrawals,
      pending
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stats failed' });
  }
};
// Export the new function
module.exports = { 
  registerUser, 
  getUserDashboard, 
  getHeaderData, 
  getUserProfile ,
  requestDeposit,
  getMyKYCStatus,
  submitKYC,
  getUserStats
};
