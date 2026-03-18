const express = require('express');
const router = express.Router();
const multer = require('multer');
const researchController = require('../controllers/research.controller');
const { authenticate, authorize, isFaculty, isStaffOrAdmin, isDean } = require('../middleware/auth.middleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// ========== PUBLIC ROUTES ==========
router.get('/published', researchController.getPublishedResearch);
router.get('/categories', researchController.getCategories);

// Get Dean/Program Chair members (for adviser to pick target when approving)
router.get('/dean-chair/members', authenticate, authorize('faculty'), researchController.getDeanChairMembers);

// Get faculty members (for student submission)
router.get('/faculty/members', authenticate, researchController.getFacultyMembers);

// ========== DEAN ONLY ROUTES (must precede /:id catch-all) ==========
router.get(
  '/dean/activity-monitor',
  authenticate,
  authorize('dean'),
  researchController.getDeanActivityMonitor
);

router.get(
  '/dean/audit-logs',
  authenticate,
  authorize('dean'),
  researchController.getAuditLogs
);

// ========== AUTHENTICATED USER ROUTES ==========
router.get('/profile/data', authenticate, researchController.getProfileResearchData);
router.get('/:id/annotations', authenticate, researchController.getPaperAnnotations);
router.post(
  '/:id/annotations',
  authenticate,
  authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'),
  researchController.addPaperAnnotation
);
router.get('/:id/file', authenticate, researchController.getResearchFile);
router.get('/:id', authenticate, researchController.getResearchById);
router.post('/:id/view', authenticate, researchController.trackView);
router.post('/:id/download', authenticate, researchController.trackDownload);

// ========== STUDENT/STAFF/ADMIN ROUTES ==========
router.post(
  '/submit',
  authenticate,
  authorize('student', 'staff', 'admin'),
  upload.single('file'),
  researchController.submitResearch
);

router.get(
  '/my/papers',
  authenticate,
  authorize('student', 'staff', 'admin'),
  researchController.getMyResearch
);

// ========== STAFF & ADMIN ROUTES ==========
router.get(
  '/all/papers',
  authenticate,
  authorize('staff', 'admin'),
  researchController.getAllResearch
);

router.post(
  '/:id/approve',
  authenticate,
  authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'),
  researchController.approveResearch
);

router.post(
  '/:id/reject',
  authenticate,
  authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'),
  researchController.rejectResearch
);

router.post(
  '/:id/revision',
  authenticate,
  authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'),
  researchController.requestRevision
);

// ========== FACULTY ROUTES ==========
router.get(
  '/faculty/assigned',
  authenticate,
  authorize('faculty'),
  researchController.getFacultyAssignedPapers
);

// ========== DEAN & PROGRAM CHAIR ROUTES ==========
router.get(
  '/dean-chair/assigned',
  authenticate,
  authorize('dean', 'program_chair'),
  researchController.getDeanChairAssignedPapers
);

// ========== ADMIN ONLY ROUTES ==========
router.get(
  '/admin/all',
  authenticate,
  authorize('admin'),
  researchController.adminGetAllResearch
);

router.put(
  '/admin/:id',
  authenticate,
  authorize('admin'),
  researchController.adminUpdateResearch
);

router.delete(
  '/admin/:id',
  authenticate,
  authorize('admin'),
  researchController.adminDeleteResearch
);

router.post(
  '/admin/:id/publish',
  authenticate,
  authorize('admin'),
  researchController.adminPublishResearch
);

router.post(
  '/admin/:id/unpublish',
  authenticate,
  authorize('admin'),
  researchController.adminUnpublishResearch
);

// ========== DEAN BYPASS (POST — no ordering issue with /:id) ==========
router.post(
  '/:id/dean-bypass',
  authenticate,
  authorize('dean'),
  researchController.deanBypassApprove
);

module.exports = router;