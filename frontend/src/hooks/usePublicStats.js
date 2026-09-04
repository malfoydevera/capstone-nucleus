import { useEffect, useState } from 'react';
import { researchAPI, unwrapApiData } from '../utils/api';

const REFRESH_MS = 60_000;

export const formatStatNumber = (value) => {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return '—';
  return count.toLocaleString();
};

export default function usePublicStats({ refresh = true } = {}) {
  const [stats, setStats] = useState({
    researchPapers: null,
    activeScholars: null,
    departments: null,
    programs: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const response = await researchAPI.getPublicStats();
        const payload = unwrapApiData(response);
        if (cancelled) return;
        setStats({
          researchPapers: payload.researchPapers ?? 0,
          activeScholars: payload.activeScholars ?? 0,
          departments: payload.departments ?? null,
          programs: payload.programs ?? null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setStats((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || 'Failed to load stats',
        }));
      }
    };

    fetchStats();
    if (!refresh) return () => { cancelled = true; };

    const intervalId = window.setInterval(fetchStats, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return stats;
}
