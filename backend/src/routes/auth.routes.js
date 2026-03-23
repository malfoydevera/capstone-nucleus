const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);

// Search students for co-author selection
router.get('/students/search', authenticate, authController.searchStudents);

// NEW: Admin Management Routes
router.get('/users', authenticate, authorize('admin'), authController.getAllUsers);
router.delete('/users/:id', authenticate, authorize('admin'), authController.deleteUser);

// Admin-only: Create privileged accounts (faculty, staff, dean, program_chair, admin)
router.post('/users/create', authenticate, authorize('admin'), authController.createPrivilegedUser);

module.exports = router;