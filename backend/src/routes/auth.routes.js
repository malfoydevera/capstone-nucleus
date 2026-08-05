const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const notificationController = require('../controllers/notification.controller');
const coauthorInvitationController = require('../controllers/coauthorInvitation.controller');
const { authRateLimiter, apiRateLimiter } = require('../middleware/rateLimiter');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validateBody, authSchemas } = require('../middleware/validate');

// Public routes
router.post('/register', authRateLimiter, validateBody(authSchemas.register), authController.register);
router.post('/login', authRateLimiter, validateBody(authSchemas.login), authController.login);
router.post('/refresh', authRateLimiter, authController.refreshSession);
router.post('/resend-confirmation', authRateLimiter, authController.resendConfirmation);
router.post('/forgot-password/request', authRateLimiter, validateBody(authSchemas.forgotPasswordRequest), authController.requestPasswordReset);
router.post('/forgot-password/confirm', authRateLimiter, validateBody(authSchemas.forgotPasswordConfirm), authController.confirmPasswordReset);

// Protected routes
router.get('/me', authenticate, apiRateLimiter, authController.getCurrentUser);
router.post('/change-password', authenticate, authRateLimiter, authController.changePassword);
router.post('/change-email', authenticate, authRateLimiter, authController.changeEmail);
router.post('/recovery-email/validate', authenticate, authRateLimiter, authController.validateRecoveryEmail);
router.post('/recovery-email/request', authenticate, authRateLimiter, authController.requestRecoveryEmail);
router.post('/recovery-email/confirm-otp', authenticate, authRateLimiter, validateBody(authSchemas.recoveryEmailOtpConfirm), authController.confirmRecoveryEmailOtp);
router.post('/recovery-email/confirm', authenticate, authRateLimiter, authController.confirmRecoveryEmail);
router.post('/confirm-institutional-email', authenticate, authRateLimiter, authController.confirmInstitutionalEmail);
router.patch('/profile', authenticate, authController.updateOwnProfile);
router.get('/profile/activity', authenticate, authController.getProfileActivity);
router.get('/notifications', authenticate, notificationController.getMyNotifications);
router.get('/notifications/unread-count', authenticate, notificationController.getUnreadCount);
router.get('/notifications/debug', authenticate, authorize('admin'), notificationController.getNotificationsDebug);
router.patch('/notifications/:id/read', authenticate, notificationController.markNotificationRead);
router.patch('/notifications/read-all', authenticate, notificationController.markAllNotificationsRead);
router.delete('/notifications', authenticate, notificationController.deleteAllNotifications);
router.delete('/notifications/:id', authenticate, notificationController.deleteNotification);
router.get('/submission-policy', authenticate, authController.getSubmissionPolicy);
router.get('/co-author-invitations', authenticate, authorize('student'), coauthorInvitationController.getMyCoAuthorInvitations);
router.post('/co-author-invitations/:token/accept', authenticate, authorize('student'), coauthorInvitationController.acceptCoAuthorInvitation);
router.post('/co-author-invitations/:token/decline', authenticate, authorize('student'), coauthorInvitationController.declineCoAuthorInvitation);

// Search students for co-author selection
router.get('/students/search', authenticate, authController.searchStudents);

// NEW: Admin Management Routes
router.get('/users', authenticate, authorize('admin'), apiRateLimiter, authController.getAllUsers);
router.get('/users/:id/records', authenticate, authorize('admin'), authController.getUserRecords);
router.post('/users/:id/records/export-pdf', authenticate, authorize('admin'), authController.exportUserRecordsPdf);
router.patch('/users/:id', authenticate, authorize('admin'), authController.updateUser);
router.delete('/users/:id', authenticate, authorize('admin'), authController.deleteUser);
router.patch('/users/:id/suspend', authenticate, authorize('admin'), authController.suspendUser);
router.patch('/users/:id/reactivate', authenticate, authorize('admin'), authController.reactivateUser);

// Admin-only: Create privileged accounts (faculty, staff, dean, program_chair, admin)
router.post('/users/create', authenticate, authorize('admin'), authController.createPrivilegedUser);
router.get('/system-health', authenticate, authorize('admin'), apiRateLimiter, authController.getSystemHealth);
router.get('/system-policy', authenticate, authorize('admin'), authController.getSystemPolicySettings);
router.patch('/system-policy', authenticate, authorize('admin'), authController.updateSystemPolicySettings);

module.exports = router;
