export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    });
  }).catch(() => {
    // Sentry optional — continue without it
  });
}
