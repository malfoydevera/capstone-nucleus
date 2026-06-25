import { RefreshCw } from 'lucide-react';

const LoadMoreFooter = ({
  visibleCount,
  totalCount,
  canLoadMore,
  onLoadMore,
  loading = false,
  label = 'items',
  step,
}) => {
  if (totalCount === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{visibleCount}</span> of{' '}
        <span className="font-semibold text-slate-700">{totalCount}</span> {label}
      </p>
      {canLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="h-8 px-4 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors self-start sm:self-auto inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {loading ? <RefreshCw size={13} className="animate-spin" /> : null}
          {loading ? 'Loading…' : `Load ${step} more`}
        </button>
      ) : (
        <p className="text-[11px] text-slate-400">All {label} loaded</p>
      )}
    </div>
  );
};

export default LoadMoreFooter;
