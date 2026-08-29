import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, api, postJson, ADMIN_HEADERS } from './helpers.js';

let idSeq = 0;
const makeMessage = () => ({
  name: `Tester ${++idSeq}`,
  email: `tester${idSeq}@example.com`,
  subject: 'Plans',
  message: 'Which plan do you recommend for a beginner?',
  plan: 'Basic',
});

describe('admin messages API', () => {
  let s;
  before(async () => {
    s = await startTestServer();
  });
  after(async () => s.close());

  const postOne = async (overrides = {}) => {
    const r = await api(
      s.base,
      '/api/contact',
      postJson({ ...makeMessage(), ...overrides })
    );
    assert.equal(r.status, 201);
    return r.body.id;
  };

  test('rejects missing admin key with 401', async () => {
    const r = await api(s.base, '/api/messages');
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, 'UNAUTHORIZED');
  });

  test('rejects a wrong admin key with 403', async () => {
    const r = await api(s.base, '/api/messages', {
      headers: { 'x-admin-key': 'wrong-key' },
    });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'FORBIDDEN');
  });

  test('accepts the key via the X-Admin-Key header', async () => {
    const first = await postOne({ message: 'First message for the inbox list.' });
    const second = await postOne({ message: 'Second message for the inbox list.' });

    const r = await api(s.base, '/api/messages', { headers: ADMIN_HEADERS });
    assert.equal(r.status, 200);
    assert.ok(r.body.total >= 2);
    assert.ok(Array.isArray(r.body.messages));

    const withPlan = r.body.messages.find((m) => m.id === first);
    assert.equal(withPlan.plan, 'Basic');

    const ids = r.body.messages.map((m) => m.id);
    // newest first
    const idxA = ids.indexOf(first);
    const idxB = ids.indexOf(second);
    assert.ok(idxB < idxA, 'newest message should come first');
  });

  test('also accepts the key as a query parameter', async () => {
    const r = await api(s.base, '/api/messages?key=test-admin-key');
    assert.equal(r.status, 200);
  });

  test('filters by status', async () => {
    const id = await postOne({ message: 'Message to be archived.' });
    const patch = await api(s.base, `/api/messages/${id}`, {
      method: 'PATCH',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    assert.equal(patch.status, 200);

    const r = await api(s.base, '/api/messages?status=archived', { headers: ADMIN_HEADERS });
    assert.equal(r.status, 200);
    assert.ok(r.body.messages.length >= 1);
    assert.ok(r.body.messages.every((m) => m.status === 'archived'));
  });

  test('supports limit/offset pagination', async () => {
    const r = await api(s.base, '/api/messages?limit=1&offset=0', { headers: ADMIN_HEADERS });
    assert.equal(r.status, 200);
    assert.equal(r.body.messages.length, 1);
    assert.equal(r.body.limit, 1);
    assert.equal(r.body.offset, 0);
  });

  test('PATCH marks a message read and validates status', async () => {
    const id = await postOne({ message: 'To be marked read.' });
    const r = await api(s.base, `/api/messages/${id}`, {
      method: 'PATCH',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.message.status, 'read');

    const bad = await api(s.base, `/api/messages/${id}`, {
      method: 'PATCH',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'spam' }),
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'BAD_REQUEST');
  });

  test('PATCH and DELETE 404 on unknown ids', async () => {
    const patch = await api(s.base, '/api/messages/999999', {
      method: 'PATCH',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    });
    assert.equal(patch.status, 404);

    const del = await api(s.base, '/api/messages/999999', {
      method: 'DELETE',
      headers: ADMIN_HEADERS,
    });
    assert.equal(del.status, 404);
  });

  test('DELETE removes a message permanently', async () => {
    const id = await postOne({ message: 'Message destined for deletion.' });
    const r = await api(s.base, `/api/messages/${id}`, {
      method: 'DELETE',
      headers: ADMIN_HEADERS,
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(s.queries.getMessage(id), null);
  });
});