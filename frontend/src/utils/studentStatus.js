const STATUS_LABELS = {
  pending_faculty: 'With Adviser',
  pending_dean: 'With Dean',
  pending_program_chair: 'With Program Chair',
  pending_editor: 'With Editor',
  pending_admin: 'With Admin',
  revision_required: 'Revision Required',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
};

const STATUS_TONES = {
  pending_faculty: 'text-amber-700 bg-amber-50 border-amber-200',
  pending_dean: 'text-sky-700 bg-sky-50 border-sky-200',
  pending_program_chair: 'text-sky-700 bg-sky-50 border-sky-200',
  pending_editor: 'text-blue-700 bg-blue-50 border-blue-200',
  pending_admin: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  revision_required: 'text-orange-700 bg-orange-50 border-orange-200',
  approved: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  published: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  rejected: 'text-rose-700 bg-rose-50 border-rose-200',
};

const NEEDS_ACTION_STATUSES = new Set(['revision_required', 'rejected']);

const IN_REVIEW_STATUSES = new Set([
  'pending_faculty',
  'pending_dean',
  'pending_program_chair',
  'pending_editor',
  'pending_admin',
]);

const DONE_STATUSES = new Set(['approved', 'published']);

export const getStudentStatusLabel = (status) =>
  STATUS_LABELS[status] || String(status || 'Unknown').replace(/_/g, ' ');

export const getStudentStatusTone = (status) =>
  STATUS_TONES[status] || 'text-slate-700 bg-slate-50 border-slate-200';

export const isNeedsAction = (status) => NEEDS_ACTION_STATUSES.has(status);

export const isInReview = (status) => IN_REVIEW_STATUSES.has(status);

export const isDone = (status) => DONE_STATUSES.has(status);
