import {
  Award,
  BookOpen,
  Check,
  FileCheck,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';

const WORKFLOW_STAGES = [
  { key: 'adviser', label: 'Adviser review', shortLabel: 'Adviser', statuses: ['pending_faculty'] },
  { key: 'dean_chair', label: 'Dean / program chair', shortLabel: 'Dean / Chair', statuses: ['pending_dean', 'pending_program_chair'] },
  { key: 'editor', label: 'Research editor', shortLabel: 'Editor', statuses: ['pending_editor'] },
  { key: 'admin', label: 'Admin review', shortLabel: 'Admin', statuses: ['pending_admin'] },
  { key: 'approved_repo', label: 'Approved (internal)', shortLabel: 'Approved', statuses: ['approved'] },
  { key: 'published', label: 'Published', shortLabel: 'Published', statuses: ['published'] },
];

const STAGE_ICONS = {
  adviser: User,
  dean_chair: Shield,
  editor: FileCheck,
  admin: ShieldCheck,
  approved_repo: BookOpen,
  published: Award,
};

export const getManuscriptWorkflowProgress = (paperStatus) => {
  const stages = WORKFLOW_STAGES.map((stage) => ({ ...stage, completed: false }));

  let currentStageIndex = -1;
  if (paperStatus === 'pending_faculty') currentStageIndex = 0;
  else if (paperStatus === 'pending_dean' || paperStatus === 'pending_program_chair') currentStageIndex = 1;
  else if (paperStatus === 'pending_editor' || paperStatus === 'revision_required') currentStageIndex = 2;
  else if (paperStatus === 'pending_admin') currentStageIndex = 3;
  else if (paperStatus === 'approved') currentStageIndex = 4;
  else if (paperStatus === 'published') currentStageIndex = 5;

  for (let i = 0; i < stages.length; i += 1) {
    if (paperStatus === 'published') {
      stages[i].completed = true;
    } else {
      stages[i].completed = i < currentStageIndex;
    }
  }

  const completedCount = stages.filter((stage) => stage.completed).length;
  const progressPercent = paperStatus === 'published'
    ? 100
    : currentStageIndex <= 0
      ? 0
      : Math.round((currentStageIndex / (stages.length - 1)) * 100);

  return { stages, currentStageIndex, completedCount, progressPercent };
};

export const shouldShowWorkflowProgress = (paper) => {
  if (!paper || paper.status === 'rejected') return false;

  return Boolean(
    paper.faculty_id
    || paper.status.includes('pending_faculty')
    || paper.status.includes('pending_editor')
    || paper.status.includes('pending_admin')
    || paper.status === 'approved'
    || paper.status === 'published',
  );
};

const stageNodeClass = (isCompleted, isCurrent) => {
  if (isCompleted) {
    return 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20';
  }
  if (isCurrent) {
    return 'border-[#3674B5] bg-white text-[#3674B5] ring-4 ring-[#3674B5]/12 shadow-sm';
  }
  return 'border-slate-200 bg-white text-slate-400';
};

const stageLabelClass = (isCompleted, isCurrent) => {
  if (isCurrent) return 'font-bold text-[#3674B5]';
  if (isCompleted) return 'font-semibold text-emerald-700';
  return 'font-medium text-slate-400';
};

const ReviewProgressTracker = ({ status }) => {
  const { stages, currentStageIndex, completedCount, progressPercent } = getManuscriptWorkflowProgress(status);
  const currentStage = currentStageIndex >= 0 ? stages[currentStageIndex] : null;
  const isRevision = status === 'revision_required';

  return (
    <section
      aria-labelledby="review-progress-heading"
      className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden"
    >
      <div
        className="h-1 bg-gradient-to-r from-[#3674B5] via-[#578FCA] to-[#3674B5]/30"
        aria-hidden="true"
      />

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3674B5]">
              Manuscript pipeline
            </p>
            <h3 id="review-progress-heading" className="mt-1 text-base sm:text-lg font-bold text-slate-900">
              {currentStage?.label || 'Review in progress'}
            </h3>
            {isRevision ? (
              <p className="mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 inline-block">
                Author revision in progress — returns to the editor when resubmitted
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Track where this submission sits across faculty, editorial, and publication stages.
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums leading-none text-[#3674B5]">
                {progressPercent}
                <span className="text-sm font-semibold">%</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {completedCount} of {stages.length} cleared
              </p>
            </div>
            <div
              className="relative h-14 w-14 shrink-0"
              role="img"
              aria-label={`${progressPercent} percent complete`}
            >
              <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-slate-200" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  className="stroke-[#578FCA]"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progressPercent} 100`}
                  pathLength="100"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-600">
                {currentStageIndex >= 0 ? currentStageIndex + 1 : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#3674B5] to-[#578FCA]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Desktop stepper */}
        <ol
          className="mt-6 hidden md:flex md:items-start md:w-full"
          aria-label="Review workflow stages"
        >
          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.key];
            const isCompleted = stage.completed;
            const isCurrent = index === currentStageIndex;
            const leftLineActive = index > 0 && (status === 'published' || index <= currentStageIndex);
            const rightLineActive = index < stages.length - 1 && (status === 'published' || index < currentStageIndex);

            return (
              <li key={stage.key} className="flex flex-1 flex-col items-center min-w-0">
                <div className="flex w-full items-center">
                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${index === 0 ? 'invisible' : leftLineActive ? 'bg-[#578FCA]' : 'bg-slate-200'}`}
                  />
                  <div className={`relative z-10 mx-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${stageNodeClass(isCompleted, isCurrent)}`}>
                    {isCompleted ? <Check size={17} strokeWidth={2.5} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                  </div>
                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${index === stages.length - 1 ? 'invisible' : rightLineActive ? 'bg-[#578FCA]' : 'bg-slate-200'}`}
                  />
                </div>

                <p className={`mt-2.5 px-1 text-[11px] leading-snug text-center ${stageLabelClass(isCompleted, isCurrent)}`}>
                  {stage.shortLabel}
                </p>

                {isCurrent ? (
                  <span className="mt-1 rounded-full bg-[#3674B5]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#3674B5]">
                    Now
                  </span>
                ) : (
                  <span className="mt-1 h-4" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>

        {/* Mobile timeline */}
        <ol className="mt-5 md:hidden space-y-3 border-l-2 border-slate-200 ml-3 pl-5" aria-label="Review workflow stages">
          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.key];
            const isCompleted = stage.completed;
            const isCurrent = index === currentStageIndex;

            return (
              <li key={stage.key} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[calc(1.25rem+1px)] top-4 flex h-3.5 w-3.5 rounded-full border-2 ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500'
                      : isCurrent
                        ? 'border-[#3674B5] bg-white ring-2 ring-[#3674B5]/15'
                        : 'border-slate-300 bg-white'
                  }`}
                />

                <div
                  className={`rounded-xl border px-3 py-2.5 ${
                    isCurrent
                      ? 'border-[#3674B5]/35 bg-[#3674B5]/[0.04]'
                      : isCompleted
                        ? 'border-emerald-100 bg-emerald-50/60'
                        : 'border-slate-100 bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : isCurrent
                            ? 'bg-[#3674B5]/10 text-[#3674B5]'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                      >
                        {isCompleted ? <Check size={14} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}
                      </span>
                      <span className={`text-sm truncate ${stageLabelClass(isCompleted, isCurrent)}`}>
                        {stage.label}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="shrink-0 rounded-full bg-[#3674B5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        Now
                      </span>
                    )}
                    {isCompleted && !isCurrent && (
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-600">Done</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

export default ReviewProgressTracker;
