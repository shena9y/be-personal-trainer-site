import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

/** Name of the httpOnly session cookie set by the auth routes. */
export const SESSION_COOKIE = 'bpt_session';

/** Hash a password into `salt:hash` (hex). Async scrypt — safe for signups/logins. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

/** Same as hashPassword but blocking — used only for one-time admin seeding. */
export function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

/** Constant-time password check against a stored `salt:hash` value. */
export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && crypto.timingSafeEqual(derived, expected);
}

/** Fresh 256-bit session token. */
export function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Cookie options used for the session token. */
export function sessionCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge: config.sessionTtlMs,
  };
}