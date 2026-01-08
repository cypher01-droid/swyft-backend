// src/controllers/publicController.js
const { db } = require('../config/firebase');

const trackStatus = async (req, res) => {
  try {
    const { code } = req.params; // e.g., RF-99201
    const trackingDoc = await db.collection('public_tracking').doc(code.toUpperCase()).get();

    if (!trackingDoc.exists) {
      return res.status(404).json({ error: 'Tracking code not found.' });
    }

    res.status(200).json(trackingDoc.data());
  } catch (error) {
    res.status(500).json({ error: 'Tracking service error.' });
  }
};

module.exports = trackStatus;
