import type { FastifyBaseLogger } from 'fastify';
import { config } from './config.js';

type SentryModule = typeof import('@sentry/node');
let sentry: SentryModule | null = null;

export async function initMonitoring(log: FastifyBaseLogger): Promise<void> {
  if (!config.sentryDsn) return;
  sentry = await import('@sentry/node');
  sentry.init({
    dsn: config.sentryDsn,
    environment: config.isProduction ? 'production' : 'development',
    tracesSampleRate: 0,
  });
  log.info('Sentry error reporting enabled');
}

export function captureError(error: unknown): void {
  sentry?.captureException(error);
}
