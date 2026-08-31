import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, api, postJson } from './helpers.js';

const VALID = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  subject: '1-on-1 sessions',
  message: 'Hi, I would like to book a first session next week.',
  plan: 'Professional',
};

async function countMessages(s) {
  return s.queries.listMessages({ status: null }).total;
}

describe('POST /api/contact', () => {
  let s;
  before(async () => {
    s = await startTestServer();
  });
  after(async () => s.close());

  test('accepts a valid message and persists it', async () => {
    const before = await countMessages(s);
    const r = await api(s.base, '/api/contact', postJson(VALID));
    assert.equal(r.status, 201);
    assert.equal(r.body.success, true);
    assert.ok(Number.isInteger(r.body.id));

    const stored = s.queries.getMessage(r.body.id);
    assert.equal(stored.name, 'Jane Smith');
    assert.equal(stored.email, 'jane@example.com');
    assert.equal(stored.subject, '1-on-1 sessions');
    assert.equal(stored.plan, 'Professional');
    assert.equal(stored.status, 'unread');
    assert.ok(stored.createdAt);

    const after = await countMessages(s);
    assert.equal(after, before + 1);
  });

  test('trims and length-limits fields', async () => {
    const r = await api(
      s.base,
      '/api/contact',
      postJson({
        name: '  John Doe  ',
        email: 'john@example.com',
        subject: 'x'.repeat(200),
        message: 'A sufficiently long message.',
        plan: '  Basic  ',
      })
    );
    assert.equal(r.status, 201);
    const stored = s.queries.getMessage(r.body.id);
    assert.equal(stored.name, 'John Doe');
    assert.equal(stored.subject.length, 150);
    assert.equal(stored.plan, 'Basic');
  });

  test('returns 400 with per-field errors for invalid payloads', async () => {
    const cases = [
      [{ ...VALID, name: '   ' }, 'name'],
      [{ ...VALID, name: '' }, 'name'],
      [{ ...VALID, email: 'not-an-email' }, 'email'],
      [{ ...VALID, email: 'a@b' }, 'email'],
      [{ ...VALID, message: 'short' }, 'message'],
      [{ ...VALID, message: '' }, 'message'],
    ];
    for (const [payload, field] of cases) {
      const r = await api(s.base, '/api/contact', postJson(payload));
      assert.equal(r.status, 400, `expected 400 for invalid ${field}`);
      assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      assert.ok(r.body.error.fields[field], `expected field error for ${field}`);
    }
  });

  test('ignores spam when the honeypot field is filled', async () => {
    const before = await countMessages(s);
    const r = await api(
      s.base,
      '/api/contact',
      postJson({ ...VALID, website: 'http://spam.example/promo' })
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.equal(await countMessages(s), before, 'honeypot submissions must not be stored');
  });

  test('handles a totally empty body', async () => {
    const r = await api(s.base, '/api/contact', postJson({}));
    assert.equal(r.status, 400);
    assert.ok(r.body.error.fields.name);
    assert.ok(r.body.error.fields.email);
    assert.ok(r.body.error.fields.message);
  });

  test('rate limits repeated submissions from one IP', async () => {
    const limited = await startTestServer({
      config: {
        CONTACT_RATE_LIMIT_MAX: '2',
        CONTACT_RATE_LIMIT_WINDOW_MS: '60000',
      },
    });
    try {
      let last;
      for (let i = 0; i < 3; i += 1) {
        last = await api(
          limited.base,
          '/api/contact',
          postJson({ ...VALID, subject: `attempt ${i}` })
        );
      }
      assert.equal(last.status, 429);
      assert.equal(last.body.error.code, 'RATE_LIMIT');
    } finally {
      await limited.close();
    }
  });
});