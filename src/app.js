// src/app.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes'); 

const app = express();

// Standard middleware for 2026 banking apps
app.use(cors()); // Allows your React Vite frontend to connect
app.use(express.json()); // Parses incoming JSON requests
app.use('/api/user', userRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
// Health check route
app.get('/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});


module.exports = app;

// Add this at the end of src/app.js
app.use((err, req, res, next) => {
  console.error("!!! SERVER ERROR !!!");
  console.error(err.stack); // This will print the EXACT line that failed in your terminal
  res.status(500).json({ error: err.message });
});
