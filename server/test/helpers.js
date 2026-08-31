import { fileURLToPath } from 'node:url';
import { createConfig } from '../src/config.js';
import { createApp, SITE_ROOT } from '../src/app.js';

export { SITE_ROOT };

/** The project root containing the static frontend (index.html etc.). */
export const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Config tailored for tests: in-memory DB, predictable admin key, generous
 * rate limit (override per-test when testing limiting itself).
 */
export function testConfig(overrides = {}) {
  return createConfig({
    NODE_ENV: 'test',
    DATABASE_PATH: ':memory:',
    ADMIN_API_KEY: 'test-admin-key',
    CONTACT_RATE_LIMIT_MAX: '100',
    CONTACT_RATE_LIMIT_WINDOW_MS: '60000',
    LOG_REQUESTS: 'false',
    ...overrides,
  });
}

/**
 * Boot the app on an ephemeral port. Returns helpers for asserting and a
 * `close()` to tear everything down.
 */
export async function startTestServer(options = {}) {
  const config = testConfig(options.config);
  const { app, db, queries } = createApp({
    config,
    staticRoot: options.staticRoot === undefined ? null : options.staticRoot,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    config,
    db,
    queries,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          try {
            db.close();
          } catch {
            // already closed
          }
          resolve();
        });
      }),
  };
}

/** Perform a JSON API request and parse the response. */
export async function api(base, path, options = {}) {
  const res = await fetch(base + path, options);
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

export const postJson = (payload) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

export const ADMIN_HEADERS = { 'x-admin-key': 'test-admin-key' };