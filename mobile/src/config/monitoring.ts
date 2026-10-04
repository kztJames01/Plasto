import * as Sentry from '@sentry/react-native';

// paste DSN from sentry.io project settings, or leave blank to disable
export const SENTRY_DSN = '';

export const SENTRY_ENV = __DEV__ ? 'development' : 'production';

export function initMonitoring() {
  if (!SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}

export function reportError(err: unknown, tags?: Record<string, string>) {
  if (!SENTRY_DSN) {
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
