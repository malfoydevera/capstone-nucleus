export const STATUS_TONES = {
  pending_faculty: 'text-amber-700 bg-amber-50 border-amber-100',
  pending_editor: 'text-blue-700 bg-blue-50 border-blue-100',
  pending_admin: 'text-[#3674B5] bg-[#3674B5]/10 border-[#3674B5]/20',
  pending_dean: 'text-violet-700 bg-violet-50 border-violet-100',
  pending_program_chair: 'text-teal-700 bg-teal-50 border-teal-100',
  approved: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  published: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  rejected: 'text-red-700 bg-red-50 border-red-100',
  revision_required: 'text-orange-700 bg-orange-50 border-orange-100',
};

/** Plain-language labels for reviewers (not internal status codes). */
export const STATUS_LABELS = {
  pending_faculty: 'Adviser review',
  pending_editor: 'Editorial review',
  pending_admin: 'Admin approval',
  pending_dean: 'Dean review',
  pending_program_chair: 'Program chair review',
  approved: 'Approved (internal)',
  published: 'Published',
  rejected: 'Rejected',
  revision_required: 'Revision requested',
};

export const reviewStatusLabel = (status) => STATUS_LABELS[status] || status;
export const reviewStatusTone = (status) => STATUS_TONES[status] || 'text-slate-600 bg-slate-50 border-slate-100';
