const express = require('express');
const router = express.Router();
const multer = require('multer');
// F-002: Split controllers
const submissionController = require('../controllers/submission.controller');
const reviewController     = require('../controllers/review.controller');
const adminController      = require('../controllers/admin.controller');
const annotationController = require('../controllers/annotation.controller');
const coauthorInvitationController = require('../controllers/coauthorInvitation.controller');
const { authenticate, authorize, isFaculty, isStaffOrAdmin, isDean } = require('../middleware/auth.middleware');
const { publishedRateLimiter, semanticSearchRateLimiter } = require('../middleware/rateLimiter');
const { MAX_BYTES, ALLOWED_MIMES, validateResearchFileBuffer } = require('../config/upload');

// Configure multer for memory storage (validated before upload completes)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_BYTES,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

const uploadDrawing = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PNG, JPEG, or WebP images are allowed'), ok);
  },
});

// Public cache headers for browse endpoints
const publicCache = (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  next();
};

// ========== PUBLIC ROUTES ==========
router.get('/published', publishedRateLimiter, publicCache, submissionController.getPublishedResearch);
router.get('/semantic-search', authenticate, semanticSearchRateLimiter, submissionController.getSemanticSearch);
router.get('/categories', submissionController.getCategories);

// Get Dean/Program Chair members (for adviser to pick target when approving)
router.get('/dean-chair/members', authenticate, authorize('faculty'), submissionController.getDeanChairMembers);

// Get faculty members (for student submission)
router.get('/faculty/members', authenticate, submissionController.getFacultyMembers);

// ========== DEAN ONLY ROUTES (must precede /:id catch-all) ==========
router.get('/dean/department-comparison', authenticate, authorize('dean'), reviewController.getDepartmentComparison);

// ========== AUTHENTICATED USER ROUTES ==========
router.get('/profile/data',           authenticate, submissionController.getProfileResearchData);
router.get('/drafts/me',              authenticate, authorize('student'), submissionController.getMyDraft);
router.put('/drafts/me',              authenticate, authorize('student'), submissionController.upsertMyDraft);
router.delete('/drafts/me',           authenticate, authorize('student'), submissionController.deleteMyDraft);
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
router.post(
  '/:id/annotated-file',
  authenticate,
  upload.single('annotated_file'),
  authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'),
  reviewController.uploadAnnotatedFile
);
router.post(
  '/:id/annotation-drawing',
  authenticate,
  authorize('faculty', 'dean', 'program_chair', 'staff', 'admin'),
  uploadDrawing.single('drawing'),
  reviewController.uploadAnnotationDrawing
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
router.post('/:id/declare-conflict', authenticate, authorize('faculty'), reviewController.declareConflictOfInterest);
router.post('/:id/return-to-author', authenticate, authorize('staff'), reviewController.returnToAuthor);
router.patch('/:id/metadata', authenticate, authorize('staff'), reviewController.correctMetadata);
router.get('/:id/plagiarism', authenticate, authorize('staff', 'admin'), reviewController.getPlagiarismReport);
router.post('/:id/plagiarism/run', authenticate, authorize('staff'), reviewController.runPlagiarismScan);
router.post('/:id/assign-faculty', authenticate, authorize('dean', 'program_chair'), reviewController.assignFacultyReviewer);
router.post('/:id/co-author-invitations', authenticate, authorize('student'), coauthorInvitationController.createCoAuthorInvitations);

// ========== FACULTY ROUTES ==========
router.get('/faculty/assigned', authenticate, authorize('faculty'), reviewController.getFacultyAssignedPapers);
router.get('/faculty/workload', authenticate, authorize('faculty'), reviewController.getFacultyWorkloadSummary);

// ========== DEAN & PROGRAM CHAIR ROUTES ==========
router.get('/dean-chair/assigned', authenticate, authorize('dean', 'program_chair'), reviewController.getDeanChairAssignedPapers);
router.get('/program-chair/analytics', authenticate, authorize('program_chair'), reviewController.getProgramChairAnalytics);
router.get('/program-chair/deadlines', authenticate, authorize('program_chair'), reviewController.getProgramChairDeadlines);
router.patch('/:id/review-deadline', authenticate, authorize('program_chair'), reviewController.setProgramChairReviewDeadline);

// ========== ADMIN ONLY ROUTES ==========
router.get('/admin/workflow-stages', authenticate, authorize('admin'), adminController.getWorkflowStages);
router.get('/admin/workflow-stages/validate', authenticate, authorize('admin'), adminController.validateWorkflowStages);
router.post('/admin/workflow-stages', authenticate, authorize('admin'), adminController.createWorkflowStage);
router.patch('/admin/workflow-stages/:stageId', authenticate, authorize('admin'), adminController.updateWorkflowStage);
router.delete('/admin/workflow-stages/:stageId', authenticate, authorize('admin'), adminController.deleteWorkflowStage);
router.get('/admin/export/papers', authenticate, authorize('admin'), adminController.exportPapersCsv);
router.get('/admin/all',           authenticate, authorize('admin'), adminController.adminGetAllResearch);
router.put('/admin/:id',           authenticate, authorize('admin'), adminController.adminUpdateResearch);
router.delete('/admin/:id',        authenticate, authorize('admin'), adminController.adminDeleteResearch);
router.post('/admin/:id/restore',  authenticate, authorize('admin'), adminController.adminRestoreResearch);
router.post('/admin/:id/publish',  authenticate, authorize('admin'), adminController.adminPublishResearch);
router.post('/admin/:id/unpublish', authenticate, authorize('admin'), adminController.adminUnpublishResearch);

// ========== DEAN BYPASS ==========
router.post('/:id/dean-bypass', authenticate, authorize('dean'), reviewController.deanBypassApprove);

module.exports = router;