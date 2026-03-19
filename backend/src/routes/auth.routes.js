const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new student account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName, role]
 *             properties:
 *               email:     { type: string, format: email }
 *               password:  { type: string, minLength: 8 }
 *               fullName:  { type: string }
 *               role:      { type: string, enum: [student] }
 *               program:   { type: string }
 *               department:{ type: string }
 *     responses:
 *       201: { description: Registered successfully }
 *       400: { description: Validation error }
 *       403: { description: Non-student role rejected }
 */
router.post('/register', authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive access + refresh tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:        { type: string, description: JWT access token (2h TTL) }
 *                     refreshToken: { type: string, description: UUID refresh token (7d TTL) }
 *                     user:         { type: object }
 *       401: { description: Invalid credentials }
 */
router.post('/login', authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access + refresh token pair (rotation)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New token pair issued }
 *       401: { description: Invalid or expired refresh token }
 */
router.post('/refresh', authController.refresh);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the currently authenticated user
 *     responses:
 *       200: { description: Current user data }
 *       401: { description: Not authenticated }
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke the refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @openapi
 * /auth/students/search:
 *   get:
 *     tags: [Auth]
 *     summary: Search students by name/email (for co-author selection)
 *     parameters:
 *       - in: query
 *         name: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: Matching students }
 */
router.get('/students/search', authenticate, authController.searchStudents);

// Admin user management
/**
 * @openapi
 * /auth/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin only)
 *     responses:
 *       200: { description: User list }
 *       403: { description: Forbidden }
 */
router.get('/users', authenticate, authorize('admin'), authController.getAllUsers);
router.delete('/users/:id', authenticate, authorize('admin'), authController.deleteUser);

/**
 * @openapi
 * /auth/users/create:
 *   post:
 *     tags: [Admin]
 *     summary: Create a privileged account (admin only)
 *     responses:
 *       201: { description: User created }
 *       403: { description: Forbidden }
 */
router.post('/users/create', authenticate, authorize('admin'), authController.createPrivilegedUser);

module.exports = router;