import { AlertCircle, FileCheck } from 'lucide-react';
import { reviewStatusLabel, reviewStatusTone } from './reviewStatus';

const ROLE_GUIDANCE = {
  faculty: {
    pending_faculty: 'You are the assigned faculty adviser. Read the manuscript, add feedback if needed, then approve, request revision, or reject.',
    revision_required: 'The author was asked to revise this paper. Review the resubmission when it returns to your queue.',
  },
  staff: {
    pending_editor: 'Editorial review: verify metadata, check formatting, and forward approved work to admin or return it to the author.',
    revision_required: 'The author submitted revisions. Confirm they addressed prior feedback before approving.',
  },
  dean: {
    pending_dean: 'Review the manuscript after faculty approval. Approve to forward downstream, assign a faculty reviewer, or reject.',
  },
  program_chair: {
    pending_program_chair: 'Program-level review: approve, request revision, assign a faculty reviewer, or set a review deadline.',
  },
  admin: {
    pending_admin: 'Final administrative approval. Approve for the internal repository or publish with a DOI.',
    revision_required: 'Review the author\'s resubmission before final approval.',
  },
};

/**
 * Explains the reviewer's current responsibility on this manuscript.
 */
const ReviewAssignmentBanner = ({ role, status }) => {
  const guidance = ROLE_GUIDANCE[role]?.[status];
  if (!guidance) return null;

  return (
    <div className="rounded-xl border border-[#3674B5]/20 bg-[#3674B5]/5 p-4 flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-[#3674B5]/20 text-[#3674B5]">
        <FileCheck size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#3674B5]">Your assignment</p>
        <p className="text-sm text-slate-800 mt-1 leading-relaxed">{guidance}</p>
        <span
          className={`inline-flex mt-2 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${reviewStatusTone(status)}`}
        >
          Current stage: {reviewStatusLabel(status)}
        </span>
      </div>
    </div>
  );
};

export const ActiveReviewerNotes = ({ revisionNotes, rejectionReason }) => {
  if (!revisionNotes && !rejectionReason) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-900">
        <AlertCircle size={16} aria-hidden="true" />
        <h4 className="text-sm font-semibold">Notes on file for the author</h4>
      </div>
      {revisionNotes && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Revision request</p>
          <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{revisionNotes}</p>
        </div>
      )}
      {rejectionReason && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800">Rejection reason</p>
          <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{rejectionReason}</p>
        </div>
      )}
    </div>
  );
};

export default ReviewAssignmentBanner;
