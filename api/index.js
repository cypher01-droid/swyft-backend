const express = require('express');
const app = require('../src/app');
// ... your middleware and routes ...

// IMPORTANT: Vercel needs the app exported to handle it as a function
module.exports = app; 
