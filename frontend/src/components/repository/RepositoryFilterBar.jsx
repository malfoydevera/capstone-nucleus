const selectClass =
  'h-10 min-w-[8.5rem] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5] cursor-pointer';

/**
 * Compact centered filter row for the Research Repository.
 */
const RepositoryFilterBar = ({
  idPrefix = 'repo-filter',
  selectedCategory,
  onCategoryChange,
  categories = [],
  yearFrom,
  yearTo,
  onYearFromChange,
  onYearToChange,
  yearOptions = [],
  sortBy,
  onSortChange,
  sortOptions = [],
  sortDisabled = false,
  onClear,
  hasActiveFilters = false,
}) => (
  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
    <label htmlFor={`${idPrefix}-category`} className="sr-only">
      Category
    </label>
    <select
      id={`${idPrefix}-category`}
      value={selectedCategory}
      onChange={(e) => onCategoryChange(e.target.value)}
      className={selectClass}
    >
      <option value="">All categories</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>

    <label htmlFor={`${idPrefix}-year-from`} className="sr-only">
      Year from
    </label>
    <select
      id={`${idPrefix}-year-from`}
      value={yearFrom}
      onChange={(e) => onYearFromChange(e.target.value)}
      className={selectClass}
    >
      <option value="">From</option>
      {yearOptions.map((year) => (
        <option key={year} value={year} disabled={yearTo && year > Number(yearTo)}>
          {year}
        </option>
      ))}
    </select>

    <label htmlFor={`${idPrefix}-year-to`} className="sr-only">
      Year to
    </label>
    <select
      id={`${idPrefix}-year-to`}
      value={yearTo}
      onChange={(e) => onYearToChange(e.target.value)}
      className={selectClass}
    >
      <option value="">To</option>
      {yearOptions.map((year) => (
        <option key={year} value={year} disabled={yearFrom && year < Number(yearFrom)}>
          {year}
        </option>
      ))}
    </select>

    <label htmlFor={`${idPrefix}-sort`} className="sr-only">
      Sort by
    </label>
    <select
      id={`${idPrefix}-sort`}
      value={sortBy}
      onChange={(e) => onSortChange(e.target.value)}
      disabled={sortDisabled}
      className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {sortOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>

    {hasActiveFilters ? (
      <button
        type="button"
        onClick={onClear}
        className="h-10 px-4 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        Clear filters
      </button>
    ) : null}
  </div>
);

export default RepositoryFilterBar;
