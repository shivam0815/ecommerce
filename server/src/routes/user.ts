// src/routes/user.js - COMPLETE WORKING VERSION
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth'); // Adjust path as needed

// Import controller functions
const {
  getUserStats,
  getUserOrders,
  updateUserProfile
} = require('../controllers/userController');

// ✅ User Routes
router.get('/stats', authenticate, getUserStats);
router.get('/orders', authenticate, getUserOrders);
router.put('/profile', authenticate, updateUserProfile);

module.exports = router;
