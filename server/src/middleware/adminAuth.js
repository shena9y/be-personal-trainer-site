import crypto from 'node:crypto';
import { SESSION_COOKIE } from '../auth.js';

/**
 * Constant-time comparison of two strings (length side-channel avoided by
 * comparing digests first).
 */
function safeEqual(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Require admin access for the messages API. Two ways in:
 *  - `X-Admin-Key` header (or `?key=` query param) matching ADMIN_API_KEY, OR
 *  - a valid session cookie for a user with the `admin` role.
 */
export function requireAdminAccess(queries, config) {
  return (req, res, next) => {
    const provided = req.get('x-admin-key') ?? req.query.key;

    // Key path (unchanged behaviour, kept for scripts/curl).
    if (provided) {
      if (safeEqual(provided, config.adminApiKey)) return next();
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Invalid admin key.' },
      });
    }

    // Session path (used by the dashboard).
    const token = (req.cookies || {})[SESSION_COOKIE];
    if (!token) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing admin key or session.' },
      });
    }
    const session = queries.getSession(token);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      if (session) queries.deleteSession(token);
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Session expired — please sign in again.' },
      });
    }
    if (session.user?.role !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Admin access required.' },
      });
    }
    next();
  };
}