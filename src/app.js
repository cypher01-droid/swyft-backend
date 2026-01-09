const express = require('express');
const cors = require('cors');
require('dotenv').config();
const admin = require('firebase-admin');

// 1. Initialize Firebase Admin (Top of file)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const app = express();

// 2. Optimized CORS for 2026
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'https://www.swyfttrust.com', 
    'https://swyfttrust.com'
  ],
  credentials: true
}));

// 3. CRITICAL: JSON Parser MUST come before routes
app.use(express.json());

// 4. Routes
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');

app.use('/api/user', userRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Health check route
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// 5. Global Error Handler
app.use((err, req, res, next) => {
  console.error("!!! SERVER ERROR !!!");
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

module.exports = app;
