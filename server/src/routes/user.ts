const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Import controller functions
const {
  getUserStats,
  getUserOrders,
  updateUserProfile,
} = require('../controllers/userController');

// ✅ Import updatePreferences from authController
const { updatePreferences } = require('../controllers/authController');

// ✅ User Routes
router.get('/stats', authenticate, getUserStats);
router.get('/orders', authenticate, getUserOrders);
router.put('/profile', authenticate, updateUserProfile);
router.put('/auth/preferences', authenticate, updatePreferences);

module.exports = router;
