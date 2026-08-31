import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validateSignup, validateLogin } from '../validate.js';
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../auth.js';
import { requireAuth } from '../middleware/sessionAuth.js';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export function authRouter(queries, config) {
  const router = Router();

  // Keep brute-force attempts in check.
  const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMIT', message: 'Too many attempts — please wait a few minutes.' },
    },
  });

  const setCookie = (res, token) =>
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config));

  /** Create a session for a user and return the public user object. */
  const startSession = (res, user) => {
    const token = newSessionToken();
    queries.createSession({
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + config.sessionTtlMs).toISOString(),
    });
    setCookie(res, token);
    return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
  };

  // POST /api/auth/signup
  router.post('/signup', limiter, async (req, res, next) => {
    try {
      const { errors, value } = validateSignup(req.body);
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Please fix the highlighted fields.', fields: errors },
        });
      }
      const email = normalizeEmail(value.email);
      if (queries.getUserByEmail(email)) {
        return res.status(409).json({
          error: { code: 'EMAIL_TAKEN', message: 'An account with that e-mail already exists. Try signing in.' },
        });
      }
      const hash = await hashPassword(value.password);
      const userId = queries.createUser({
        name: value.name,
        email,
        passwordHash: hash,
        role: 'user',
      });
      const user = queries.getUserById(userId);
      res.status(201).json({ user: startSession(res, user) });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/login
  router.post('/login', limiter, async (req, res, next) => {
    try {
      const { errors, value } = validateLogin(req.body);
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Please fix the highlighted fields.', fields: errors },
        });
      }
      const email = normalizeEmail(value.email);
      const user = queries.getUserByEmail(email);
      const ok = user && (await verifyPassword(value.password, user.passwordHash));
      if (!ok) {
        return res.status(401).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Wrong e-mail or password.' },
        });
      }
      res.json({ user: startSession(res, user) });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    const token = (req.cookies || {})[SESSION_COOKIE];
    if (token) queries.deleteSession(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  // GET /api/auth/me — current user (null-safe for logged-out visitors)
  router.get('/me', requireAuth(queries), (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}