import { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { COMMON_GUIDANCE, getRoleGuidance, ROLE_GUIDANCE } from '../../utils/guidance';
import { BookOpen, CircleHelp, Compass, LifeBuoy } from 'lucide-react';

const UserGuide = () => {
  const { user } = useAuth();
  const activeGuidance = useMemo(() => getRoleGuidance(user?.role), [user?.role]);

  return (
    <div className="page-shell page-stack animate-fadeIn">
      <section className="page-hero">
        <div className="page-hero__copy">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-[#1C4D8D]/10 px-3 py-1 text-sm font-semibold text-[#1C4D8D]">
            <BookOpen size={15} />
            User Guide
          </p>
          <h1 className="page-title">Guidance And Support</h1>
          <p className="page-description">
            This guide explains what each role can do in NUCLEUS, where to start on each page, and how to recover when a task is blocked.
          </p>
        </div>
      </section>

      <section className="surface-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1C4D8D]/10 text-[#1C4D8D]">
            <Compass size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{activeGuidance.heading}</h2>
            <p className="mt-1 text-sm text-slate-600">{activeGuidance.summary}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Recommended Flow</h3>
            <ol className="mt-3 space-y-3">
              {activeGuidance.dashboardSteps.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm text-slate-700">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1C4D8D]/10 text-xs font-bold text-[#1C4D8D]">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Support Notes</h3>
            <ul className="mt-3 space-y-3">
              {[...activeGuidance.support, ...COMMON_GUIDANCE.bullets.slice(0, 1)].map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-700">
                  <CircleHelp size={16} className="mt-0.5 flex-shrink-0 text-[#1C4D8D]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="surface-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <LifeBuoy size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Role Coverage</h2>
            <p className="mt-1 text-sm text-slate-600">
              Every account should have the same guidance structure even when the workflow is different.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(ROLE_GUIDANCE).map(([role, config]) => (
            <article key={role} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-base font-bold text-slate-900">{config.heading}</h3>
              <p className="mt-1 text-sm text-slate-600">{config.summary}</p>
              <ul className="mt-4 space-y-2">
                {config.dashboardSteps.slice(0, 2).map((step) => (
                  <li key={step} className="text-sm text-slate-700">
                    {step}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default UserGuide;
