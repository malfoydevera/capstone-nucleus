import { Activity } from 'lucide-react';
import ReviewWorkspaceLayout from './ReviewWorkspaceLayout';
export { reviewStatusLabel, reviewStatusTone } from './reviewStatus';

/** @deprecated Use ReviewWorkspaceLayout — kept for gradual migration. */
const ReviewListShell = ReviewWorkspaceLayout;
export default ReviewListShell;

export { default as ReviewWorkspaceLayout } from './ReviewWorkspaceLayout';
export { default as ReviewDetailNav } from './ReviewDetailNav';

export const PriorityBanner = ({ icon: Icon = Activity, label, title, action }) => (
  <div className="rounded-xl border border-l-4 border-amber-400 border-l-amber-500 bg-amber-50 p-4 w-full min-w-0">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
          <Icon size={13} className="shrink-0" aria-hidden="true" />
          {label}
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-900 break-words line-clamp-3 sm:line-clamp-2">{title}</p>
      </div>
      {action && <div className="shrink-0 w-full sm:w-auto">{action}</div>}
    </div>
  </div>
);
