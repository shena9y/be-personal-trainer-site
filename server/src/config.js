import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');

const toInt = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const toBool = (value) => String(value).toLowerCase() === 'true';

/**
 * Build a validated config object from process env (or a passed-in env).
 */
export function createConfig(env = process.env) {
  const databasePath =
    env.DATABASE_PATH && env.DATABASE_PATH.trim() !== ''
      ? (env.DATABASE_PATH === ':memory:' ||
        path.isAbsolute(env.DATABASE_PATH)
        ? env.DATABASE_PATH
        : path.resolve(SERVER_ROOT, env.DATABASE_PATH))
      : path.join(SERVER_ROOT, 'data', 'fit-site.sqlite');

  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: toInt(env.PORT, 3000),
    host: env.HOST || '127.0.0.1',
    host: env.HOST || "0.0.0.0",
    databasePath,
    adminApiKey: env.ADMIN_API_KEY || 'change-me-before-deploying',

    // Admin account bootstrap (created when the users table is empty)
    adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || '',

    // Auth sessions
    sessionTtlMs: toInt(env.SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000), // 7 days

    // Contact-form rate limiting (per IP)
    contactRateLimitMax: toInt(env.CONTACT_RATE_LIMIT_MAX, 5),
    contactRateLimitWindowMs: toInt(env.CONTACT_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),

    // Optional SMTP notification
    smtpHost: env.SMTP_HOST || '',
    smtpPort: toInt(env.SMTP_PORT, 587),
    smtpSecure: toBool(env.SMTP_SECURE),
    smtpUser: env.SMTP_USER || '',
    smtpPass: env.SMTP_PASS || '',
    smtpFrom: env.SMTP_FROM || 'Be Personal Trainer <no-reply@bepersonal.example>',
    notifyTo: env.NOTIFY_TO || '',

    logRequests: env.LOG_REQUESTS !== 'false',
    trustProxy: toBool(env.TRUST_PROXY || 'false'),
  };
}
