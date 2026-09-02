import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { createConfig, SERVER_ROOT } from './config.js';
import { openDatabase } from './db.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { SESSION_COOKIE } from './auth.js';
import { healthRouter } from './routes/health.js';
import { plansRouter } from './routes/plans.js';
import { statsRouter } from './routes/stats.js';
import { contactRouter } from './routes/contact.js';
import { messagesRouter } from './routes/messages.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The project root — where the static frontend lives (next to server/). */
export const SITE_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Build the Express app. Options let tests inject a config and/or database
 * and skip static file serving.
 *
 * @param {{ config?: object, db?: object, staticRoot?: string|null }} [options]
 */
export function createApp(options = {}) {
  const config = options.config ?? createConfig(process.env);
  const { db, queries } = options.db
    ? { db: options.db, queries: options.queries ?? options.db.queries }
    : openDatabase(config.databasePath, {
        adminEmail: config.adminEmail,
        adminPassword: config.adminPassword,
      });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Tiny cookie parser (no dependency) so session auth can read the cookie.
  app.use((req, res, next) => {
    const raw = req.headers.cookie || '';
    const cookies = {};
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i === -1) continue;
      try {
        const name = part.slice(0, i).trim();
        const value = part.slice(i + 1).trim();
        if (name) cookies[decodeURIComponent(name)] = decodeURIComponent(value);
      } catch {
        // malformed cookie — ignore it
      }
    }
    req.cookies = cookies;
    next();
  });

  // Security headers. CSP is intentionally turned off: the page loads Google
  // Fonts, Unsplash images and a YouTube iframe from third-party hosts, and the
  // admin inbox (admin.html) uses an inline script. Helmet ships a strict
  // default CSP even without configuration, which blocked all of those — so
  // disable it explicitly. CORP is relaxed to cross-origin so the third-party
  // resources keep working.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(express.json({ limit: '16kb' }));

  // One-line request log
  if (config.logRequests) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  // The dashboard page must be guarded BEFORE static serving, otherwise
  // express.static would hand it out without a session. Signed-out visitors
  // are sent to the login page instead of a JSON error.
  const staticRoot = options.staticRoot === undefined ? SITE_ROOT : options.staticRoot;
  const dashboardPage = path.join(SITE_ROOT, 'dashboard.html');
  if (staticRoot) {
    const dashboardGuard = (req, res, next) => {
      const token = (req.cookies || {})[SESSION_COOKIE];
      const session = token ? queries.getSession(token) : null;
      if (session && new Date(session.expiresAt).getTime() >= Date.now() && session.user) {
        req.user = session.user;
        return next();
      }
      if (session) queries.deleteSession(token);
      // Browsing humans get bounced to the sign-in page (remembering where
      // they were headed so login can send them back); API clients get JSON.
      const wantsJson = (req.headers.accept || '').includes('application/json');
      if (wantsJson) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } });
      }
      const loginTarget = encodeURIComponent(req.originalUrl || '/dashboard.html');
      return res.redirect(`/login.html?next=${loginTarget}`);
    };
    app.get('/dashboard', dashboardGuard, (req, res) => res.sendFile(dashboardPage));
    app.get('/dashboard.html', dashboardGuard, (req, res) => res.sendFile(dashboardPage));
    app.get(/^\/dashboard/, (req, res) => {
      res.redirect('/login.html');
    });
  }

  // Serve the static frontend (index.html, styles.css, script.js, icons, …)
  if (staticRoot) {
    app.use(
      express.static(staticRoot, {
        etag: true,
        maxAge: config.nodeEnv === 'production' ? '1h' : 0,
        index: 'index.html',
        setHeaders: (res, filePath) => {
          if (path.extname(filePath) === '.html') {
            res.setHeader('Cache-Control', 'no-store');
          }
        },
      })
    );
  }

  // API
  app.use('/api/plans', plansRouter(queries));
  app.use('/api/stats', statsRouter(queries));
  app.use('/api/contact', contactRouter(db, queries, config));
  app.use('/api/messages', messagesRouter(db, queries, config));
  app.use('/api/auth', authRouter(queries, config));
  app.use('/api/dashboard', dashboardRouter(queries));
  app.use('/healthz', healthRouter(db, config));

  app.use(notFound);
  app.use(errorHandler);

  return { app, db, queries, config };
}
