import { SESSION_COOKIE } from '../auth.js';

/**
 * Require a valid session cookie and attach `req.user`.
 * Sessions live in SQLite; expired ones are deleted as they are seen.
 */
export function requireAuth(queries) {
  return (req, res, next) => {
    const token = (req.cookies || {})[SESSION_COOKIE];
    const deny = (status, code, message) =>
      res.status(status).json({ error: { code, message } });

    if (!token) return deny(401, 'UNAUTHORIZED', 'Please sign in to continue.');

    const session = queries.getSession(token);
    if (!session) {
      return deny(401, 'UNAUTHORIZED', 'Session not found — please sign in again.');
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      queries.deleteSession(token);
      return deny(401, 'UNAUTHORIZED', 'Session expired — please sign in again.');
    }
    if (!session.user) {
      return deny(401, 'UNAUTHORIZED', 'Account not found — please sign in again.');
    }

    req.user = session.user;
    next();
  };
}

/** Require a session cookie AND an admin role. */
export function requireAdmin(queries) {
  const auth = requireAuth(queries);
  return (req, res, next) => {
    auth(req, res, (err) => {
      if (err) return next(err);
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Admin access required.' },
        });
      }
      next();
    });
  };
}