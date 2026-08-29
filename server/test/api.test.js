import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, api, PROJECT_ROOT } from './helpers.js';

describe('public API', () => {
  let s;
  before(async () => {
    s = await startTestServer();
  });
  after(async () => s.close());

  test('GET /healthz reports ok with the database up', async () => {
    const r = await api(s.base, '/healthz');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
    assert.equal(r.body.db, 'up');
    assert.equal(typeof r.body.uptime, 'number');
    assert.match(r.body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });

  test('GET /api/plans returns the three tiers matching the site pricing', async () => {
    const r = await api(s.base, '/api/plans');
    assert.equal(r.status, 200);
    const plans = r.body.plans;
    assert.equal(plans.length, 3);
    assert.deepEqual(
      plans.map((p) => p.name),
      ['Basic', 'Professional', 'Advanced']
    );

    const basic = plans.find((p) => p.slug === 'basic');
    assert.equal(basic.priceMonthly, 39);
    assert.equal(basic.priceYearly, 31);
    assert.equal(basic.tagline, 'Self-guided plan with monthly check-ins.');
    assert.deepEqual(
      basic.features.map((f) => f.text),
      ['Monthly training plan', 'Weekly video review', '1:1 sessions']
    );
    assert.deepEqual(
      basic.features.map((f) => f.included),
      [true, false, false]
    );

    const pro = plans.find((p) => p.slug === 'professional');
    assert.equal(pro.priceMonthly, 59);
    assert.equal(pro.priceYearly, 47);
    assert.equal(pro.accent, 'orange');

    const adv = plans.find((p) => p.slug === 'advanced');
    assert.equal(adv.priceMonthly, 89);
    assert.equal(adv.priceYearly, 71);
    assert.equal(adv.accent, 'purple');
    assert.equal(adv.features.length, 3);
    assert.equal(adv.features[2].included, true);
  });

  test('GET /api/stats returns the coaching figures shown on the site', async () => {
    const r = await api(s.base, '/api/stats');
    assert.equal(r.status, 200);
    const stats = r.body.stats;
    assert.equal(stats.length, 4);

    const bySlug = Object.fromEntries(stats.map((stat) => [stat.slug, stat]));
    assert.equal(bySlug['years-coaching'].value, 12);
    assert.equal(bySlug['years-coaching'].suffix, '+');
    assert.equal(bySlug['athletes-coached'].value, 500);
    assert.equal(bySlug['sessions-delivered'].value, 15000);
    assert.equal(bySlug['client-rating'].value, 4.9);
    assert.equal(bySlug['client-rating'].decimals, 1);
    assert.equal(bySlug['client-rating'].suffix, '★');
    assert.equal(bySlug['client-rating'].label, 'Average client rating');
  });

  test('unknown API route returns a JSON 404', async () => {
    const r = await api(s.base, '/api/does-not-exist');
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'NOT_FOUND');
  });

  test('malformed JSON body returns 400 BAD_JSON', async () => {
    const res = await fetch(`${s.base}/api/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_JSON');
  });
});

describe('static file serving', () => {
  let s;
  before(async () => {
    s = await startTestServer({ staticRoot: PROJECT_ROOT });
  });
  after(async () => s.close());

  test('GET / serves the landing page', async () => {
    const res = await fetch(`${s.base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, /<title>Be Personal Trainer/);
    assert.match(html, /contactForm/);
  });

  test('GET /styles.css and /script.js are served', async () => {
    const css = await fetch(`${s.base}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const js = await fetch(`${s.base}/script.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /javascript/);
  });

  test('HTML is not cached while assets are cached', async () => {
    const html = await fetch(`${s.base}/index.html`);
    assert.match(html.headers.get('cache-control') ?? '', /no-store/);

    const icon = await fetch(`${s.base}/icon.png`);
    assert.equal(icon.status, 200);
    assert.ok(icon.headers.has('etag'));
  });

  test('unknown static path returns 404', async () => {
    const res = await fetch(`${s.base}/missing-file.txt`);
    assert.equal(res.status, 404);
  });
});