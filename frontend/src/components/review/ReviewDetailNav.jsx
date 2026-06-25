import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';

/**
 * Compact sticky header for the single-page manuscript review workspace.
 */
const ReviewDetailNav = ({
  backPath,
  breadcrumbs = [],
  title,
  statusBadge,
  trailing,
}) => (
  <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
    <div className="review-screen__inner py-2.5 sm:py-3">
      <div className="flex items-center gap-2 min-w-0 mb-2">
        {backPath && (
          <Link
            to={backPath}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-[#3674B5] transition-colors"
            aria-label="Back to review queue"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
        )}
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[11px] sm:text-xs text-slate-500"
        >
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight size={11} className="shrink-0 text-slate-300" aria-hidden="true" />}
              {crumb.path ? (
                <Link to={crumb.path} className="truncate hover:text-[#3674B5] transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-slate-600">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-full">
            {title || 'Untitled manuscript'}
          </h1>
          {statusBadge}
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      </div>
    </div>
  </header>
);

export default ReviewDetailNav;
