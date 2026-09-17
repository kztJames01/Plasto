import * as Sentry from '@sentry/react';

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export function reportError(err, tags) {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return;
  }
  Sentry.withScope(scope => {
    if (tags) {
      for (const [k, v] of Object.entries(tags)) {
        scope.setTag(k, v);
      }
    }
    Sentry.captureException(err);
  });
}
