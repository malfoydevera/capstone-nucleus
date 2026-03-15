const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const dc = require('../controllers/department.controller');

// ─── Public ──────────────────────────────────────────────────────────────────
// GET /api/departments — list all active departments + nested programs
router.get('/', dc.getAllDepartments);

// GET /api/departments/:id/programs — list programs for one department
router.get('/:id/programs', dc.getProgramsByDepartment);

// ─── Admin only ───────────────────────────────────────────────────────────────
// POST /api/departments — create a new department
router.post('/', authenticate, authorize('admin'), dc.createDepartment);

// PUT /api/departments/:id — update department name/code/description/is_active
router.put('/:id', authenticate, authorize('admin'), dc.updateDepartment);

// DELETE /api/departments/:id — soft-delete (sets is_active = false)
router.delete('/:id', authenticate, authorize('admin'), dc.deleteDepartment);

// POST /api/departments/:id/programs — add a program under a department
router.post('/:id/programs', authenticate, authorize('admin'), dc.createProgram);

// PUT /api/programs/:programId — update program (no department route needed)
router.put('/programs/:programId', authenticate, authorize('admin'), dc.updateProgram);

// DELETE /api/programs/:programId — soft-delete program
router.delete('/programs/:programId', authenticate, authorize('admin'), dc.deleteProgram);

module.exports = router;
