jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));

jest.mock('../../utils/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/fileAccess', () => ({
  resolvePaperFileUrl: jest.fn(),
}));

jest.mock('../../utils/workflowPolicy', () => ({
  WORKFLOW_POLICY: {
    deanBypass: {
      blockedStatuses: ['approved', 'published', 'rejected'],
    },
  },
  validateWorkflowAction: jest.fn(() => ({ ok: true })),
}));

jest.mock('../../utils/workflowEngine', () => ({
  getActiveWorkflowStages: jest.fn().mockResolvedValue([]),
  resolveApprovalTransition: jest.fn(),
  resolveRevisionTransition: jest.fn(),
  resolveRejectionStatus: jest.fn(() => 'rejected'),
  resolveBypassTargets: jest.fn(() => ['approved']),
}));

jest.mock('../../utils/name', () => ({
  attachFullName: jest.fn((value) => value),
  buildFullName: jest.fn(() => 'Author Name'),
}));

jest.mock('../../utils/workflowEmail', () => ({
  sendPaperStatusEmail: jest.fn().mockResolvedValue(undefined),
  sendReviewAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/plagiarism', () => ({
  runPlagiarismCheck: jest.fn(),
}));

jest.mock('pdfkit', () => jest.fn());

const supabase = require('../../config/supabase');
const { logAuditEvent } = require('../../utils/audit');
const reviewController = require('../../controllers/review.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('review controller workflow event compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('declareConflictOfInterest records a valid pending_editor workflow event', async () => {
    const workflowInsert = jest.fn().mockResolvedValue({ error: null });
    let researchPapersCalls = 0;

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        researchPapersCalls += 1;

        if (researchPapersCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'paper-1',
                    title: 'Paper',
                    status: 'pending_faculty',
                    author_id: 'author-1',
                    faculty_id: 'faculty-1',
                    author: {
                      first_name: 'Stu',
                      middle_name: null,
                      last_name: 'Dent',
                      email: 'student@example.com',
                    },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === 'faculty_conflict_declarations') {
        return {
          upsert: async () => ({ error: null }),
        };
      }

      if (table === 'approval_workflow') {
        return {
          insert: workflowInsert,
        };
      }

      if (table === 'users') {
        const query = { eq: jest.fn() };
        query.eq
          .mockReturnValueOnce(query)
          .mockResolvedValueOnce({ data: [{ id: 'staff-1' }], error: null });

        return {
          select: () => query,
        };
      }

      if (table === 'notifications') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      return {
        insert: async () => ({ error: null }),
      };
    });

    const req = {
      params: { id: 'paper-1' },
      body: { reason: 'Conflict exists.' },
      user: { id: 'faculty-1', role: 'faculty' },
    };
    const res = createRes();

    await reviewController.declareConflictOfInterest(req, res);

    expect(workflowInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'pending',
        action_type: 'conflict_declared',
        previous_status: 'pending_faculty',
        new_status: 'pending_editor',
      }),
    ]);
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  test('assignFacultyReviewer records a pending assignment workflow event', async () => {
    const workflowInsert = jest.fn().mockResolvedValue({ error: null });
    let researchPapersCalls = 0;

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        researchPapersCalls += 1;

        if (researchPapersCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'paper-1',
                    title: 'Paper',
                    status: 'pending_program_chair',
                    author_id: 'author-1',
                    department: 'CS',
                    department_id: null,
                    dean_chair_id: 'chair-1',
                    author: {
                      first_name: 'Stu',
                      middle_name: null,
                      last_name: 'Dent',
                      email: 'student@example.com',
                    },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'paper-1',
                    status: 'pending_faculty',
                    faculty_id: 'faculty-1',
                    dean_chair_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'users') {
        const query = {
          eq: jest.fn().mockReturnThis(),
          single: async () => ({
            data: {
              id: 'faculty-1',
              first_name: 'Fac',
              middle_name: null,
              last_name: 'Reviewer',
              email: 'faculty@example.com',
              role: 'faculty',
              department: 'CS',
              department_id: null,
            },
            error: null,
          }),
        };

        return {
          select: () => query,
        };
      }

      if (table === 'approval_workflow') {
        return {
          insert: workflowInsert,
        };
      }

      if (table === 'notifications') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      return {
        insert: async () => ({ error: null }),
      };
    });

    const req = {
      params: { id: 'paper-1' },
      body: { facultyId: 'faculty-1', notes: 'Please review.' },
      user: { id: 'chair-1', role: 'program_chair' },
    };
    const res = createRes();

    await reviewController.assignFacultyReviewer(req, res);

    expect(workflowInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'pending',
        action_type: 'assigned_to_faculty',
        previous_status: 'pending_program_chair',
        new_status: 'pending_faculty',
      }),
    ]);
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  test('returnToAuthor records a revision-required workflow event', async () => {
    const workflowInsert = jest.fn().mockResolvedValue({ error: null });
    let researchPapersCalls = 0;

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        researchPapersCalls += 1;

        if (researchPapersCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'paper-1',
                    title: 'Paper',
                    status: 'pending_editor',
                    author_id: 'author-1',
                    author: {
                      first_name: 'Stu',
                      middle_name: null,
                      last_name: 'Dent',
                      email: 'student@example.com',
                    },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'paper-1',
                    status: 'revision_required',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'approval_workflow') {
        return {
          insert: workflowInsert,
        };
      }

      if (table === 'notifications') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      return {
        insert: async () => ({ error: null }),
      };
    });

    const req = {
      params: { id: 'paper-1' },
      body: { notes: 'Please fix citations.' },
      user: { id: 'staff-1', role: 'staff' },
    };
    const res = createRes();

    await reviewController.returnToAuthor(req, res);

    expect(workflowInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'revision_required',
        action_type: 'returned_to_author',
        previous_status: 'pending_editor',
        new_status: 'revision_required',
      }),
    ]);
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  test('rejectResearch records workflow history without writing faculty_reviews', async () => {
    const workflowInsert = jest.fn().mockResolvedValue({ error: null });
    let researchPapersCalls = 0;

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        researchPapersCalls += 1;

        if (researchPapersCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'paper-1',
                    title: 'Rejected Paper',
                    status: 'pending_faculty',
                    faculty_id: 'faculty-1',
                    dean_chair_id: null,
                    author_id: 'author-1',
                    author: {
                      first_name: 'Stu',
                      middle_name: null,
                      last_name: 'Dent',
                      email: 'student@example.com',
                    },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === 'approval_workflow') {
        return {
          insert: workflowInsert,
        };
      }

      if (table === 'notifications') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      return {
        insert: async () => ({ error: null }),
      };
    });

    const req = {
      params: { id: 'paper-1' },
      body: { reason: 'Needs major revisions', rejectionCategory: 'quality' },
      user: { id: 'faculty-1', role: 'faculty' },
    };
    const res = createRes();

    await reviewController.rejectResearch(req, res);

    expect(workflowInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'rejected',
        action_type: 'reject',
        previous_status: 'pending_faculty',
        new_status: 'rejected',
      }),
    ]);
    expect(supabase.from.mock.calls.some(([table]) => table === 'faculty_reviews')).toBe(false);
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });
});
