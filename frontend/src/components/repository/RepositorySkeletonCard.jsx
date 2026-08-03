/**
 * Skeleton placeholders for the Research Repository results area.
 * Mirrors the real card DOM (color bar, badges, title, abstract, author/date,
 * keywords) so swapping to live data causes no layout shift.
 */
const GridSkeletonCard = () => (
  <div
    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-pulse"
    aria-hidden="true"
  >
    <div className="h-2 bg-slate-200" />
    <div className="p-6">
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 rounded-full bg-slate-100" />
          <div className="h-6 w-16 rounded-full bg-slate-100" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 w-8 rounded bg-slate-100" />
          <div className="h-3 w-8 rounded bg-slate-100" />
        </div>
      </div>

      <div className="h-5 w-5/6 rounded bg-slate-200 mb-2" />
      <div className="h-5 w-1/2 rounded bg-slate-200 mb-4" />

      <div className="space-y-2 mb-4">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-28 rounded bg-slate-100" />
        <div className="h-3 w-16 rounded bg-slate-100" />
      </div>

      <div className="flex gap-2 mb-4">
        <div className="h-6 w-16 rounded-full bg-slate-100" />
        <div className="h-6 w-14 rounded-full bg-slate-100" />
        <div className="h-6 w-12 rounded-full bg-slate-100" />
      </div>

      <div className="pt-4 border-t border-slate-100">
        <div className="h-3 w-2/3 rounded bg-slate-100 mx-auto" />
      </div>
    </div>
  </div>
);

const ListSkeletonCard = () => (
  <div
    className="bg-white rounded-2xl shadow-sm border border-slate-200 animate-pulse"
    aria-hidden="true"
  >
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-6 w-20 rounded-full bg-slate-100" />
            <div className="h-6 w-16 rounded-full bg-slate-100" />
            <div className="h-3 w-14 rounded bg-slate-100" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>

          <div className="h-6 w-3/4 rounded bg-slate-200 mb-3" />

          <div className="space-y-2 mb-4">
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-5/6 rounded bg-slate-100" />
          </div>

          <div className="flex items-center gap-4">
            <div className="h-3 w-28 rounded bg-slate-100" />
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-48">
          <div className="h-11 w-full rounded-xl bg-slate-200" />
          <div className="h-3 w-3/4 rounded bg-slate-100 mx-auto" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * Drop-in replacement for the results grid/list while a fetch is in flight.
 * Keeps the same container classes as the live results so nothing shifts
 * when real cards render in. Pass a smaller `count` when appending
 * (e.g. during "load more") vs. replacing the whole results area.
 */
const ResultsSkeleton = ({ viewMode = 'grid', count }) => {
  if (viewMode === 'list') {
    return (
      <div className="space-y-4" role="status" aria-label="Loading research papers">
        {Array.from({ length: count ?? 4 }).map((_, index) => (
          <ListSkeletonCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      role="status"
      aria-label="Loading research papers"
    >
      {Array.from({ length: count ?? 6 }).map((_, index) => (
        <GridSkeletonCard key={index} />
      ))}
    </div>
  );
};

export default ResultsSkeleton;
