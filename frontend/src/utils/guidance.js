export const ROLE_GUIDANCE = {
  student: {
    heading: 'Student Researcher Guide',
    summary: 'Use NUCLEUS to submit papers, respond to revision requests, and monitor each review stage from adviser approval through publication.',
    dashboardSteps: [
      'Start from the dashboard to see pending actions, recent submissions, and shortcuts to submit or track research.',
      'Use My Research to monitor status changes, revision notes, and publication outcomes for each paper.',
      'Open Notifications for deadline updates, return notes, and co-author invitation activity.',
    ],
    support: [
      'Before submitting, prepare a final PDF, title, abstract, keywords, department, and adviser.',
      'If a paper is returned, review the notes first, then resubmit from the highlighted action panel.',
    ],
  },
  faculty: {
    heading: 'Faculty Adviser Guide',
    summary: 'Faculty advisers screen assigned research, leave academic feedback, and forward qualified papers to the next reviewer.',
    dashboardSteps: [
      'Check the dashboard for pending assignments, approval rate, and overdue review items.',
      'Use the Review Queue to filter by status, search by author or title, and open each submission for detailed feedback.',
      'Document conflicts of interest immediately so papers can be reassigned without delay.',
    ],
    support: [
      'Use clear approval comments or revision notes so students understand the next step without follow-up.',
      'If a paper was returned from staff or admin, review the highlighted notes before making a decision.',
    ],
  },
  staff: {
    heading: 'Research Editor Guide',
    summary: 'Editors validate metadata, return incomplete submissions, and keep the institutional review pipeline moving.',
    dashboardSteps: [
      'Use the dashboard to monitor queue load, approval rate, and recent submissions needing editorial attention.',
      'In Review Submissions, filter by status and open each paper to correct metadata or return it for revision.',
      'Use Profile and Notifications to keep track of your own activity and system updates.',
    ],
    support: [
      'Editorial actions should explain what was changed or what the author must fix next.',
      'Treat “needs review” and “revision required” as separate work states so the queue remains predictable.',
    ],
  },
  admin: {
    heading: 'Administrator Guide',
    summary: 'Administrators manage final approvals, user records, analytics, and system policies that affect every role.',
    dashboardSteps: [
      'Review the dashboard for pending approvals, growth metrics, and direct links to user management and analytics.',
      'Use Final Approval to publish or reject submissions that have already passed earlier reviews.',
      'Use System Health and Settings to resolve data-quality issues and enforce consistent upload policies.',
    ],
    support: [
      'Check User Management for organization gaps, name-review gaps, and role assignment issues before they affect workflow.',
      'Use analytics and health panels to explain backlog or policy issues before changing the workflow.',
    ],
  },
  dean: {
    heading: 'Dean Oversight Guide',
    summary: 'The dean monitors cross-department performance, reviews escalations, and intervenes when the process stalls.',
    dashboardSteps: [
      'Use the dashboard to watch inactivity alerts, escalation notices, and cross-department trends.',
      'Open Activity Monitor for workflow visibility and Audit Logs for accountability history.',
      'Use the Review Queue only for papers routed to dean-level oversight or bypass decisions.',
    ],
    support: [
      'Document bypass reasons clearly because they affect the audit trail and user trust.',
      'Compare departments using the dashboard before acting on isolated queue spikes.',
    ],
  },
  program_chair: {
    heading: 'Program Chair Guide',
    summary: 'Program chairs handle program-scoped clearance, monitor deadlines, and forward qualified papers to the editor.',
    dashboardSteps: [
      'Watch your dashboard for pending reviews, deadline risk, and program keyword trends.',
      'Use the Review Queue to assign decisions consistently for papers within your program scope.',
      'Prioritize items marked due soon or overdue so faculty and student expectations stay clear.',
    ],
    support: [
      'Approval should mean the paper is ready for editorial review, not just academically promising.',
      'Use deadline indicators to set expectations before papers become escalation cases.',
    ],
  },
};

export const COMMON_GUIDANCE = {
  title: 'Need Help?',
  bullets: [
    'Each page should explain what it is for, what actions are available, and what happens after you submit or approve something.',
    'Statuses should always include a plain-language meaning, not just a badge color or internal workflow term.',
    'If you are unsure where to start, open the User Guide from the sidebar for role-specific steps and support guidance.',
  ],
};

export const getRoleGuidance = (role) =>
  ROLE_GUIDANCE[role] || {
    heading: 'User Guide',
    summary: 'Use the dashboard to review current tasks, notifications, and the next recommended actions for your account.',
    dashboardSteps: COMMON_GUIDANCE.bullets,
    support: [],
  };
