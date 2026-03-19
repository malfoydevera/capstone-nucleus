const express = require('express');
const router = express.Router();
const multer = require('multer');
// F-002: Split controllers
const submissionController = require('../controllers/submission.controller');
const reviewController     = require('../controllers/review.controller');
const adminController      = require('../controllers/admin.controller');
const annotationController = require('../controllers/annotation.controller');
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
router.get('/published', submissionController.getPublishedResearch);
router.get('/categories', submissionController.getCategories);

// Get Dean/Program Chair members (for adviser to pick target when approving)
router.get('/dean-chair/members', authenticate, authorize('faculty'), submissionController.getDeanChairMembers);

// Get faculty members (for student submission)
router.get('/faculty/members', authenticate, submissionController.getFacultyMembers);

// ========== DEAN ONLY ROUTES (must precede /:id catch-all) ==========
router.get('/dean/activity-monitor', authenticate, authorize('dean'), reviewController.getDeanActivityMonitor);
router.get('/dean/audit-logs',       authenticate, authorize('dean'), reviewController.getAuditLogs);

// ========== AUTHENTICATED USER ROUTES ==========
router.get('/profile/data',           authenticate, submissionController.getProfileResearchData);
router.get('/:id/annotations',        authenticate, annotationController.getPaperAnnotations);
router.post(
  '/:id/annotations',
  authenticate,
  authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'),
  annotationController.addPaperAnnotation
);
router.delete(
  '/:id/annotations/:annotationId',
  authenticate,
  authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'),
  annotationController.deletePaperAnnotation
);
router.get('/:id/file',     authenticate, submissionController.getResearchFile);
router.get('/:id',          authenticate, submissionController.getResearchById);
router.post('/:id/view',    authenticate, submissionController.trackView);
router.post('/:id/download', authenticate, submissionController.trackDownload);

// ========== STUDENT/STAFF/ADMIN ROUTES ==========
router.post('/submit', authenticate, authorize('student', 'staff', 'admin'), upload.single('file'), submissionController.submitResearch);
router.get('/my/papers', authenticate, authorize('student', 'staff', 'admin'), submissionController.getMyResearch);

// ========== STAFF & ADMIN ROUTES ==========
router.get('/all/papers', authenticate, authorize('staff', 'admin'), adminController.getAllResearch);

router.post('/:id/approve',   authenticate, authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'), reviewController.approveResearch);
router.post('/:id/reject',    authenticate, authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'), reviewController.rejectResearch);
router.post('/:id/revision',  authenticate, authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'), reviewController.requestRevision);

// ========== FACULTY ROUTES ==========
router.get('/faculty/assigned', authenticate, authorize('faculty'), reviewController.getFacultyAssignedPapers);

// ========== DEAN & PROGRAM CHAIR ROUTES ==========
router.get('/dean-chair/assigned', authenticate, authorize('dean', 'program_chair'), reviewController.getDeanChairAssignedPapers);

// ========== ADMIN ONLY ROUTES ==========
router.get('/admin/all',           authenticate, authorize('admin'), adminController.adminGetAllResearch);
router.put('/admin/:id',           authenticate, authorize('admin'), adminController.adminUpdateResearch);
router.delete('/admin/:id',        authenticate, authorize('admin'), adminController.adminDeleteResearch);
router.post('/admin/:id/publish',  authenticate, authorize('admin'), adminController.adminPublishResearch);
router.post('/admin/:id/unpublish', authenticate, authorize('admin'), adminController.adminUnpublishResearch);

// ========== DEAN BYPASS ==========
router.post('/:id/dean-bypass', authenticate, authorize('dean'), reviewController.deanBypassApprove);

module.exports = router;