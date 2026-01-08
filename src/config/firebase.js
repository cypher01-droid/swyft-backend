// src/config/firebase.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
require('dotenv').config();

// Securely load your service account key from your root folder
// Ensure serviceAccountKey.json is added to your .gitignore
const serviceAccount = require('../../serviceAccountKey.json');

const app = initializeApp({
  credential: cert(serviceAccount),
  // Optional: databaseURL: process.env.FIREBASE_DB_URL
});

// Export services for use in your controllers
const db = getFirestore();
const auth = getAuth();

module.exports = { db, auth };
