/**
 * Shared section heading for the single-page review layout.
 */
const ReviewSection = ({ id, icon: Icon, title, description, action, children, className = '' }) => (
  <section
    id={id}
    className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}
  >
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/50">
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3674B5]/10 text-[#3674B5] mt-0.5">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0 self-start sm:self-center">{action}</div>}
    </div>
    <div className="p-3 sm:p-5">{children}</div>
  </section>
);

export default ReviewSection;
