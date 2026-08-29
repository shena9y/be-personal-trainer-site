import { createApp, SITE_ROOT } from '../src/app.js';
import { createConfig } from '../src/config.js';

/**
 * End-to-end smoke test: boots the real server (static site + API), exercises
 * every public endpoint, the full contact lifecycle, and static serving.
 * Exits non-zero if anything looks wrong.  Run with `npm run smoke`.
 */

const base = (port) => `http://127.0.0.1:${port}`;

const checks = [];
const ok = (name, condition) => {
  checks.push(condition);
  console.log(`${condition ? '✓' : '✗'} ${name}`);
};

async function run() {
  const config = createConfig({ ...process.env, DATABASE_PATH: ':memory:' });
  const { app, db, queries } = createApp({ config });
  const server = app.listen(0, '127.0.0.1');
  const port = await new Promise((resolve) => server.once('listening', () => resolve(server.address().port)));
  const origin = base(port);
  console.log(`Smoke server on ${origin} (serving ${SITE_ROOT})\n`);

  try {
    // Static frontend
    const home = await fetch(`${origin}/`);
    ok('serves / (landing page)', home.ok && (await home.text()).includes('Be Personal Trainer'));
    const css = await fetch(`${origin}/styles.css`);
    ok('serves /styles.css', css.ok);

    // Public API
    const health = await (await fetch(`${origin}/healthz`)).json();
    ok('GET /healthz -> ok', health.status === 'ok' && health.db === 'up');

    const plans = await (await fetch(`${origin}/api/plans`)).json();
    ok(
      'GET /api/plans -> 3 tiers',
      plans.plans.length === 3 &&
        plans.plans[0].priceMonthly === 39 &&
        plans.plans[2].priceMonthly === 89
    );

    const stats = await (await fetch(`${origin}/api/stats`)).json();
    ok(
      'GET /api/stats -> 4 figures',
      stats.stats.length === 4 && stats.stats[3].value === 4.9
    );

    // Contact lifecycle
    const post = await fetch(`${origin}/api/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Test',
        email: 'smoke@example.com',
        subject: 'Lifecycle check',
        message: 'This message exercises the full contact lifecycle.',
        plan: 'Professional',
      }),
    });
    const created = await post.json();
    ok('POST /api/contact -> 201 + id', post.status === 201 && Number.isInteger(created.id));

    const auth = { 'x-admin-key': config.adminApiKey };
    const list = await (await fetch(`${origin}/api/messages`, { headers: auth })).json();
    ok(
      'GET /api/messages (admin) lists it with the plan attached',
      list.messages.length === 1 &&
        list.messages[0].id === created.id &&
        list.messages[0].plan === 'Professional'
    );

    const patched = await fetch(`${origin}/api/messages/${created.id}`, {
      method: 'PATCH',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    });
    const patchedBody = await patched.json();
    ok('PATCH /api/messages/:id -> read', patched.ok && patchedBody.message.status === 'read');

    const deleted = await fetch(`${origin}/api/messages/${created.id}`, { method: 'DELETE', headers: auth });
    ok('DELETE /api/messages/:id -> ok', deleted.ok && (await deleted.json()).ok === true);

    // Honeypot
    const spam = await fetch(`${origin}/api/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Bot',
        email: 'bot@example.com',
        message: 'I am a spam bot filling every field.',
        website: 'http://spam.example',
      }),
    });
    const spamBody = await spam.json();
    ok('honeypot submission accepted but not stored', spam.status === 200 && queries.listMessages({ status: null }).total === 0);
  } finally {
    server.close();
    db.close();
  }

  const failed = checks.filter((c) => !c).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});