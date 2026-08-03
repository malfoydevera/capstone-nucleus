import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  Search,
  RefreshCw,
  LayoutList,
  SlidersHorizontal,
} from 'lucide-react';
import LoadMoreFooter from '../ui/LoadMoreFooter';
import useAutoLoadMore from '../../hooks/useAutoLoadMore';
import { reviewStatusLabel, reviewStatusTone } from './reviewStatus';

const DEFAULT_FILTER_VALUES = new Set(['all', 'newest', '']);

const SubmissionRowSkeleton = () => (
  <div
    className="w-full rounded-xl border border-slate-200 bg-white p-4 sm:p-5 2xl:p-6 animate-pulse"
    aria-hidden="true"
  >
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="h-5 w-24 rounded-full bg-slate-100" />
          <div className="h-3 w-28 rounded bg-slate-100" />
        </div>
        <div className="h-4 w-3/4 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
        <div className="h-11 w-32 rounded-lg bg-slate-100" />
      </div>
    </div>
  </div>
);

const SubmissionRow = ({ submission, renderRowActions }) => (
  <article className="w-full rounded-xl border border-slate-200 bg-white p-4 sm:p-5 2xl:p-6 hover:border-[#3674B5]/25 transition-colors">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${reviewStatusTone(submission.status)}`}
          >
            {reviewStatusLabel(submission.status)}
          </span>
          <span className="text-xs text-slate-500">
            Submitted {submission.formattedDate || '—'}
          </span>
        </div>

        <button
          type="button"
          onClick={submission.onOpen}
          className="block w-full text-left"
        >
          <h3 className="text-base font-semibold text-slate-900 hover:text-[#3674B5] break-words leading-snug">
            {submission.title || 'Untitled manuscript'}
          </h3>
        </button>

        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">{submission.authorName || 'Unknown author'}</span>
          {submission.categoryName && (
            <span className="text-slate-400"> · {submission.categoryName}</span>
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
        {renderRowActions?.(submission)}
        <button
          type="button"
          onClick={submission.onOpen}
          className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-lg bg-[#3674B5] px-4 text-sm font-semibold text-white hover:bg-[#2d6299] transition-colors"
        >
          Open review
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  </article>
);

const FilterField = ({ filter, idPrefix = 'filter' }) => (
  <div className="min-w-0">
    <label htmlFor={`${idPrefix}-${filter.id}`} className="block text-xs font-medium text-slate-600 mb-1.5">
      {filter.label}
    </label>
    <select
      id={`${idPrefix}-${filter.id}`}
      value={filter.value}
      onChange={(e) => filter.onChange?.(e.target.value)}
      className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]"
    >
      {filter.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

/**
 * Reviewer workspace: queue navigation + searchable manuscript list.
 */
const ReviewWorkspaceLayout = ({
  breadcrumbs = [],
  roleLabel,
  title,
  subtitle,
  badge,
  lastRefreshed,
  refreshing,
  onRefresh,
  queueItems = [],
  activeQueue,
  onQueueChange,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search by title, author, or keyword…',
  advancedFilters = [],
  priorityBanner = null,
  isEmpty,
  emptyTitle = 'No manuscripts in this queue',
  emptyDescription = 'Try another queue or adjust your filters.',
  submissions = [],
  pageSize = 10,
  headerExtra = null,
  renderRowActions,
  loading = false,
}) => {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visibleSubmissions = useMemo(
    () => submissions.slice(0, visibleCount),
    [submissions, visibleCount],
  );
  const canLoadMore = visibleCount < submissions.length;
  const loadMoreRef = useAutoLoadMore({ canLoadMore, setVisibleCount, step: pageSize });

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [activeQueue, searchTerm, submissions.length, pageSize]);

  const activeQueueMeta = queueItems.find((item) => item.key === activeQueue);
  const activeFilterCount = advancedFilters.filter(
    (filter) => !DEFAULT_FILTER_VALUES.has(filter.value),
  ).length;

  const formatRelative = (date) => {
    if (!date) return null;
    const secs = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    return date.toLocaleTimeString();
  };

  const renderQueueButton = (item, { compact = false } = {}) => {
    const isActive = activeQueue === item.key;
    const displayLabel = compact && item.shortLabel ? item.shortLabel : item.label;

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => onQueueChange?.(item.key)}
        aria-current={isActive ? 'true' : undefined}
        title={compact && item.shortLabel ? item.label : undefined}
        className={`text-left rounded-xl border transition-colors ${
          compact ? 'shrink-0 px-3.5 py-2.5' : 'w-full px-3.5 py-3'
        } ${
          isActive
            ? 'border-[#3674B5] bg-[#3674B5]/5'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-sm font-semibold leading-snug break-words ${isActive ? 'text-[#3674B5]' : 'text-slate-900'}`}>
              {displayLabel}
            </p>
            {item.description && !compact && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
            )}
          </div>
          {typeof item.count === 'number' && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                isActive ? 'bg-[#3674B5] text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item.count}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="review-screen flex flex-1 min-h-0 flex-col h-full">
      <header className="border-b border-slate-200 bg-white shrink-0 w-full">
        <div className="review-screen__inner py-3 border-b border-slate-100">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 && <ChevronRight size={12} className="text-slate-300" aria-hidden="true" />}
                {crumb.path ? (
                  <Link to={crumb.path} className="hover:text-[#3674B5] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-700">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="review-screen__inner py-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {roleLabel && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#3674B5] mb-1">
                {roleLabel}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="text-sm text-slate-600 mt-1.5 max-w-3xl 2xl:max-w-4xl leading-relaxed">{subtitle}</p>}
            {lastRefreshed && (
              <p className="text-[11px] text-slate-400 mt-1">
                Updated {formatRelative(lastRefreshed)}
              </p>
            )}
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 text-sm font-medium transition-colors shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              Refresh
            </button>
          )}
        </div>

        {headerExtra && <div className="review-screen__inner pb-4">{headerExtra}</div>}
      </header>

      {priorityBanner && <div className="review-screen__inner pt-4 shrink-0 w-full">{priorityBanner}</div>}

      <div className="review-workspace-body flex-col lg:flex-row bg-white lg:bg-slate-100/60 w-full flex-1">
        {/* Queue navigation — desktop sidebar (full height) */}
        <aside
          aria-label="Review queues"
          className="hidden lg:flex lg:w-72 xl:w-80 shrink-0 flex-col border-r border-slate-200 bg-white min-h-0 h-full"
        >
          <div className="shrink-0 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <LayoutList size={14} aria-hidden="true" />
              Review queues
            </div>
          </div>
          <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
            {queueItems.map((item) => renderQueueButton(item))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full w-full bg-slate-50/80 lg:bg-white">
          {/* Queue navigation — mobile & tablet */}
          <nav
            aria-label="Review queues"
            className="lg:hidden shrink-0 border-b border-slate-200 bg-white overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
          >
            <div className="flex gap-2 review-panel__pad py-3">
              {queueItems.map((item) => renderQueueButton(item, { compact: true }))}
            </div>
          </nav>

          {/* Search + filters */}
          <div className="shrink-0 border-b border-slate-200 bg-white review-panel__pad py-4 space-y-4 w-full">
            <div className="relative">
              <label htmlFor="review-search" className="sr-only">Search manuscripts</label>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="review-search"
                type="search"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5] focus:bg-white"
              />
            </div>

            {advancedFilters.length > 0 && (
              <>
                <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {advancedFilters.map((filter) => (
                    <FilterField key={filter.id} filter={filter} idPrefix="desktop" />
                  ))}
                </div>

                <div className="md:hidden">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((open) => !open)}
                    aria-expanded={filtersOpen}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-[#3674B5] text-white px-1.5 py-0.5 text-[10px] font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  {filtersOpen && (
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      {advancedFilters.map((filter) => (
                        <FilterField key={filter.id} filter={filter} idPrefix="mobile" />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{activeQueueMeta?.label || 'Queue'}</span>
                {!loading && (
                  <span className="text-slate-500">
                    {' '}· {submissions.length} manuscript{submissions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
              {activeFilterCount > 0 && (
                <p className="text-xs text-[#3674B5] font-medium">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
                </p>
              )}
            </div>
          </div>

          {/* Manuscript list — scrollable, fills remaining height */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full">
            {loading ? (
              <div
                className="review-panel__pad py-4 sm:py-5 pb-8 space-y-4 w-full max-w-none 2xl:space-y-5"
                role="status"
                aria-label="Loading manuscripts"
              >
                {Array.from({ length: Math.min(pageSize, 6) }).map((_, index) => (
                  <SubmissionRowSkeleton key={index} />
                ))}
              </div>
            ) : isEmpty ? (
              <div className="review-panel__pad py-6 min-h-[min(24rem,50vh)] flex items-center justify-center">
                <div className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                  <FileText size={32} className="mx-auto text-slate-300" aria-hidden="true" />
                  <h3 className="mt-4 text-base font-semibold text-slate-800">{emptyTitle}</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">{emptyDescription}</p>
                </div>
              </div>
            ) : (
              <div className="review-panel__pad py-4 sm:py-5 pb-8 space-y-4 w-full max-w-none 2xl:space-y-5">
                {visibleSubmissions.map((submission) => (
                  <SubmissionRow
                    key={submission.id}
                    submission={submission}
                    renderRowActions={renderRowActions}
                  />
                ))}

                {submissions.length > pageSize && (
                  <>
                    <LoadMoreFooter
                      visibleCount={visibleSubmissions.length}
                      totalCount={submissions.length}
                      canLoadMore={canLoadMore}
                      onLoadMore={() => setVisibleCount((count) => count + pageSize)}
                      label="manuscripts"
                      step={pageSize}
                    />
                    <div ref={loadMoreRef} className="h-1" aria-hidden="true" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewWorkspaceLayout;
