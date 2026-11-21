const isProduction = process.env.NODE_ENV === 'production';

function read(name: string, devFallback: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProduction) throw new Error(`${name} must be set when NODE_ENV=production`);
  return devFallback;
}

const jwtSecret = read('JWT_SECRET', 'dev-secret-change-me');
if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

const seedDemo = process.env.SEED_DEMO === 'true';
if (isProduction && seedDemo) {
  throw new Error('SEED_DEMO must not be enabled in production');
}

const smsProvider = (process.env.SMS_PROVIDER?.trim() || (isProduction ? 'none' : 'console')) as
  | 'console'
  | 'none';
if (smsProvider !== 'console' && smsProvider !== 'none') {
  throw new Error('SMS_PROVIDER must be "console" or "none"');
}

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: read('DATABASE_URL', 'postgres://ecocycle:ecocycle@localhost:5436/ecocycle'),
  jwtSecret,
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  seedDemo,
  sentryDsn: process.env.SENTRY_DSN?.trim() || undefined,
  logLevel: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  dbPoolMax: Number(process.env.DB_POOL_MAX ?? 10),
  trustProxy: process.env.TRUST_PROXY !== 'false',
  smsProvider,
  smsFrom: process.env.SMS_FROM?.trim() || 'EcoCycle',
  otp: {
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    resendSeconds: Number(process.env.OTP_RESEND_SECONDS ?? 60),
  },
} as const;
