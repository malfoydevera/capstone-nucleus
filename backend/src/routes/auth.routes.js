const express = require('express');
const router = express.Router();
const multer = require('multer');
const authController = require('../controllers/auth.controller');
const notificationController = require('../controllers/notification.controller');
const coauthorInvitationController = require('../controllers/coauthorInvitation.controller');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 2 * 1024 * 1024 },
});

// Public routes
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);
router.get('/notifications', authenticate, notificationController.getMyNotifications);
router.get('/notifications/unread-count', authenticate, notificationController.getUnreadCount);
router.patch('/notifications/:id/read', authenticate, notificationController.markNotificationRead);
router.patch('/notifications/read-all', authenticate, notificationController.markAllNotificationsRead);
router.get('/submission-policy', authenticate, authController.getSubmissionPolicy);
router.get('/co-author-invitations', authenticate, authorize('student'), coauthorInvitationController.getMyCoAuthorInvitations);
router.post('/co-author-invitations/:token/accept', authenticate, authorize('student'), coauthorInvitationController.acceptCoAuthorInvitation);
router.post('/co-author-invitations/:token/decline', authenticate, authorize('student'), coauthorInvitationController.declineCoAuthorInvitation);

// Search students for co-author selection
router.get('/students/search', authenticate, authController.searchStudents);

// NEW: Admin Management Routes
router.get('/users', authenticate, authorize('admin'), authController.getAllUsers);
router.delete('/users/:id', authenticate, authorize('admin'), authController.deleteUser);
router.patch('/users/:id/suspend', authenticate, authorize('admin'), authController.suspendUser);
router.patch('/users/:id/reactivate', authenticate, authorize('admin'), authController.reactivateUser);

// Admin-only: Create privileged accounts (faculty, staff, dean, program_chair, admin)
router.post('/users/create', authenticate, authorize('admin'), authController.createPrivilegedUser);
router.post('/users/import-csv', authenticate, authorize('admin'), upload.single('file'), authController.bulkImportUsersCsv);
router.get('/system-health', authenticate, authorize('admin'), authController.getSystemHealth);
router.get('/system-policy', authenticate, authorize('admin'), authController.getSystemPolicySettings);
router.patch('/system-policy', authenticate, authorize('admin'), authController.updateSystemPolicySettings);

module.exports = router;