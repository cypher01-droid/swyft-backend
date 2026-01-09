// src/app.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes'); 

const app = express();
app.use(cors({
  origin: 'http://localhost:5173', // Change this to match your frontend port
  credentials: true
}));
app.use('/api/user', userRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use(express.json()); // Parses incoming JSON requests

// Health check route
app.get('/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});
// Inside src/app.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    // Parses the JSON string from Vercel's Environment Variables
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
// Add this at the end of src/app.js
app.use((err, req, res, next) => {
  console.error("!!! SERVER ERROR !!!");
  console.error(err.stack); // This will print the EXACT line that failed in your terminal
  res.status(500).json({ error: err.message });
});

module.exports = app;


