import { HelpCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const GuidancePanel = ({
  title = 'Quick Guide',
  description,
  items = [],
  tone = 'blue',
  linkTo = '/guide',
  linkLabel = 'Open full guide',
}) => {
  const toneClassMap = {
    blue: 'border-blue-200 bg-blue-50/85',
    amber: 'border-amber-200 bg-amber-50/85',
    emerald: 'border-emerald-200 bg-emerald-50/85',
    violet: 'border-violet-200 bg-violet-50/85',
    slate: 'border-slate-200 bg-slate-50/85',
  };

  return (
    <section className={`guide-panel ${toneClassMap[tone] || toneClassMap.blue}`}>
      <div>
        <h2 className="guide-panel__title">
          <HelpCircle size={18} className="text-[#1C4D8D]" />
          {title}
        </h2>
        {description ? <p className="guide-panel__description mt-2">{description}</p> : null}
      </div>

      {items.length > 0 ? (
        <ol className="guide-panel__list">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="guide-panel__item">
              <span className="guide-panel__step">{index + 1}</span>
              <span className="text-sm text-slate-700">{item}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="guide-panel__actions">
        <Link to={linkTo} className="guide-link">
          {linkLabel}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
};

export default GuidancePanel;
