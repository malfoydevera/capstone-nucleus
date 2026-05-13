jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));

jest.mock('../../utils/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/workflowEmail', () => ({
  sendPaperStatusEmail: jest.fn().mockResolvedValue(undefined),
  sendReviewAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

const supabase = require('../../config/supabase');
const { logAuditEvent } = require('../../utils/audit');
const reviewController = require('../../controllers/review.controller');
const { supabaseGenericFallback } = require('../helpers/supabaseNotificationsMock');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function mockFetchPaper(paper) {
  supabase.from.mockImplementation((table) => {
    if (table === 'research_papers') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: paper, error: null }),
          }),
        }),
      };
    }

    return supabaseGenericFallback(table);
  });
}

describe('research workflow endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('approveResearch rejects invalid transition', async () => {
    mockFetchPaper({
      id: 'p1',
      status: 'pending_admin',
      faculty_id: 'f1',
      dean_chair_id: 'd1',
      title: 'Paper',
      author_id: 'a1',
    });

    const req = {
      params: { id: 'p1' },
      body: { comments: 'ok' },
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await reviewController.approveResearch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_WORKFLOW_TRANSITION');
  });

  test('rejectResearch requires reason', async () => {
    const req = {
      params: { id: 'p1' },
      body: {},
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await reviewController.rejectResearch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  test('requestRevision rejects invalid transition', async () => {
    mockFetchPaper({
      id: 'p1',
      status: 'pending_admin',
      faculty_id: 'f1',
      dean_chair_id: 'd1',
      title: 'Paper',
      author_id: 'a1',
    });

    const req = {
      params: { id: 'p1' },
      body: { notes: 'need changes' },
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await reviewController.requestRevision(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INVALID_WORKFLOW_TRANSITION');
  });

  test('deanBypassApprove blocks finalized papers', async () => {
    mockFetchPaper({
      id: 'p1',
      status: 'approved',
      title: 'Done Paper',
      author_id: 'a1',
      author: { full_name: 'Author One' },
    });

    const req = {
      params: { id: 'p1' },
      body: { reason: 'urgent', targetStatus: 'approved' },
      user: { id: 'd1', role: 'dean' },
    };
    const res = createRes();

    await reviewController.deanBypassApprove(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INVALID_WORKFLOW_TRANSITION');
  });

  test('rejectResearch success writes audit and returns success envelope', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  status: 'pending_faculty',
                  faculty_id: 'f1',
                  dean_chair_id: 'd1',
                  author_id: 'a1',
                  title: 'Paper',
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === 'approval_workflow') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      if (table === 'users') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
            in: async () => ({ data: [], error: null }),
          }),
        };
      }

      if (table === 'workflow_stages') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: { reason: 'Not aligned yet' },
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await reviewController.rejectResearch(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Research rejected successfully');
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  test('assignFacultyReviewer requires facultyId', async () => {
    const req = {
      params: { id: 'p1' },
      body: {},
      user: { id: 'd1', role: 'dean' },
    };
    const res = createRes();

    await reviewController.assignFacultyReviewer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  test('assignFacultyReviewer blocks program chair not assigned to paper', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Paper',
                  status: 'pending_program_chair',
                  author_id: 'a1',
                  dean_chair_id: 'other-chair',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: { facultyId: 'f1' },
      user: { id: 'chair-1', role: 'program_chair' },
    };
    const res = createRes();

    await reviewController.assignFacultyReviewer(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('ACCESS_DENIED');
  });

  test('assignFacultyReviewer success moves paper to pending_faculty', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Paper',
                  status: 'pending_program_chair',
                  author_id: 'a1',
                  department: 'CS',
                  department_id: null,
                  dean_chair_id: 'chair-1',
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'p1',
                    status: 'pending_faculty',
                    faculty_id: 'f1',
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
        const userQuery = {
          eq: jest.fn().mockReturnThis(),
          single: async () => ({
            data: {
              id: 'f1',
              first_name: 'Fac',
              middle_name: null,
              last_name: 'Reviewer',
              email: 'fac@example.com',
              role: 'faculty',
              department: 'CS',
              department_id: null,
            },
            error: null,
          }),
        };

        return {
          select: () => userQuery,
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: { facultyId: 'f1', notes: 'Please review methodology section.' },
      user: { id: 'chair-1', role: 'program_chair' },
    };
    const res = createRes();

    await reviewController.assignFacultyReviewer(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Faculty reviewer assigned successfully');
    expect(payload.data.paper.status).toBe('pending_faculty');
    expect(payload.data.paper.faculty_id).toBe('f1');
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  test('returnToAuthor requires notes', async () => {
    const req = {
      params: { id: 'p1' },
      body: {},
      user: { id: 's1', role: 'staff' },
    };
    const res = createRes();

    await reviewController.returnToAuthor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  test('returnToAuthor success updates paper to revision_required', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Paper',
                  status: 'pending_editor',
                  author_id: 'a1',
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
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'p1',
                    status: 'revision_required',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: { notes: 'Please fix citations and formatting.' },
      user: { id: 'staff-1', role: 'staff' },
    };
    const res = createRes();

    await reviewController.returnToAuthor(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Paper returned to author successfully');
    expect(payload.data.newStatus).toBe('revision_required');
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  test('correctMetadata requires at least one field', async () => {
    const req = {
      params: { id: 'p1' },
      body: {},
      user: { id: 'staff-1', role: 'staff' },
    };
    const res = createRes();

    await reviewController.correctMetadata(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  test('correctMetadata updates title and keywords for staff', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Old Title',
                  abstract: 'Old abstract',
                  keywords: ['old'],
                  category: 'Category',
                  status: 'pending_editor',
                  author_id: 'a1',
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'p1',
                    title: 'New Title',
                    abstract: 'New abstract',
                    keywords: ['new', 'keywords'],
                    category: 'Category',
                    status: 'pending_editor',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: {
        title: 'New Title',
        abstract: 'New abstract',
        keywords: 'new, keywords',
      },
      user: { id: 'staff-1', role: 'staff' },
    };
    const res = createRes();

    await reviewController.correctMetadata(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Paper metadata corrected successfully');
    expect(payload.data.paper.title).toBe('New Title');
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  test('approveResearch allows staff approval from pending_editor', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Paper',
                  status: 'pending_editor',
                  author_id: 'a1',
                  department: 'CS',
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
          update: () => ({
            eq: () => ({
              select: async () => ({
                data: [{ id: 'p1', status: 'pending_admin' }],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'users') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
            in: async () => ({ data: [], error: null }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: { comments: 'Editorial checks completed.' },
      user: { id: 'staff-1', role: 'staff' },
    };
    const res = createRes();

    await reviewController.approveResearch(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('pending_admin');
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  test('setProgramChairReviewDeadline requires deadlineAt', async () => {
    const req = {
      params: { id: 'p1' },
      body: {},
      user: { id: 'chair-1', role: 'program_chair' },
    };
    const res = createRes();

    await reviewController.setProgramChairReviewDeadline(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  test('setProgramChairReviewDeadline saves deadline for in-scope paper', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'chair-1',
                  department: 'CS',
                  department_id: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Paper',
                  status: 'pending_program_chair',
                  dean_chair_id: 'chair-1',
                  department: 'CS',
                  department_id: null,
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'p1',
                    title: 'Paper',
                    status: 'pending_program_chair',
                    review_deadline_at: '2026-12-31T08:00:00.000Z',
                    dean_chair_id: 'chair-1',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: { deadlineAt: '2026-12-31T08:00:00.000Z' },
      user: { id: 'chair-1', role: 'program_chair' },
    };
    const res = createRes();

    await reviewController.setProgramChairReviewDeadline(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Review deadline set successfully');
    expect(payload.data.paper.review_deadline_at).toBe('2026-12-31T08:00:00.000Z');
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  test('getPlagiarismReport returns current plagiarism payload for staff/admin', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Paper',
                  status: 'pending_editor',
                  plagiarism_status: 'checked',
                  plagiarism_score: 27,
                  plagiarism_checked_at: '2026-04-01T01:00:00.000Z',
                  plagiarism_provider: 'local_stub',
                  plagiarism_summary: 'Stub plagiarism scan complete.',
                  plagiarism_report: { mode: 'stub' },
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      user: { id: 'staff-1', role: 'staff' },
    };
    const res = createRes();

    await reviewController.getPlagiarismReport(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.plagiarism.status).toBe('checked');
    expect(payload.data.plagiarism.score).toBe(27);
  });

  test('runPlagiarismScan is deprecated and returns 410', async () => {
    const req = {
      params: { id: 'p1' },
      user: { id: 'staff-1', role: 'staff' },
    };
    const res = createRes();

    await reviewController.runPlagiarismScan(req, res);

    expect(res.status).toHaveBeenCalledWith(410);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('PLAGIARISM_RUN_DEPRECATED');
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  test('declareConflictOfInterest blocks faculty not assigned to paper', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Paper',
                  status: 'pending_faculty',
                  author_id: 'a1',
                  faculty_id: 'other-faculty',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: { reason: 'Conflict reason' },
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await reviewController.declareConflictOfInterest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('ACCESS_DENIED');
  });

  test('declareConflictOfInterest success removes paper from faculty queue', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  title: 'Paper',
                  status: 'pending_faculty',
                  author_id: 'a1',
                  faculty_id: 'f1',
                },
                error: null,
              }),
            }),
          }),
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

      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: [{ id: 'staff-1' }], error: null }),
            }),
          }),
        };
      }

      return supabaseGenericFallback(table);
    });

    const req = {
      params: { id: 'p1' },
      body: { reason: 'I collaborated with the author on this topic.' },
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await reviewController.declareConflictOfInterest(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('pending_editor');
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });
});
