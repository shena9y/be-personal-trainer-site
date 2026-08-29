import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, api, postJson, PROJECT_ROOT } from './helpers.js';

/** Extract the `name=value` part of the session cookie from a response. */
const cookieOf = (r) => {
  const raw = r.headers.get('set-cookie') || '';
  return raw.split(';')[0];
};

describe('auth: signup, login, sessions', () => {
  let s;
  before(async () => {
    s = await startTestServer({
      config: { ADMIN_EMAIL: 'admin@test.dev', ADMIN_PASSWORD: 'admin-pass-123' },
    });
  });
  after(async () => s.close());

  test('signup rejects invalid payloads with field errors', async () => {
    const r = await api(s.base, '/api/auth/signup', postJson({ name: '', email: 'nope', password: 'short' }));
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
    assert.match(r.body.error.fields.name, /name/i);
    assert.match(r.body.error.fields.email, /e-mail/i);
    assert.match(r.body.error.fields.password, /8/);
  });

  test('signup creates a user and starts a session', async () => {
    const r = await api(
      s.base,
      '/api/auth/signup',
      postJson({ name: 'Jane Doe', email: 'Jane@Example.com', password: 'correct-horse-1' })
    );
    assert.equal(r.status, 201);
    assert.equal(r.body.user.name, 'Jane Doe');
    assert.equal(r.body.user.email, 'jane@example.com'); // normalized
    assert.equal(r.body.user.role, 'user');
    assert.ok(!r.body.user.passwordHash, 'password hash must never leak');
    assert.match(cookieOf(r), /^bpt_session=/);
  });

  test('signup with a taken e-mail returns 409', async () => {
    const r = await api(
      s.base,
      '/api/auth/signup',
      postJson({ name: 'Imposter', email: 'jane@example.com', password: 'correct-horse-1' })
    );
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'EMAIL_TAKEN');
  });

  test('login rejects a wrong password', async () => {
    const r = await api(
      s.base,
      '/api/auth/login',
      postJson({ email: 'jane@example.com', password: 'wrong-password' })
    );
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, 'INVALID_CREDENTIALS');
  });

  test('login succeeds and /api/auth/me returns the user', async () => {
    const login = await api(
      s.base,
      '/api/auth/login',
      postJson({ email: 'jane@example.com', password: 'correct-horse-1' })
    );
    assert.equal(login.status, 200);
    const cookie = cookieOf(login);

    const me = await api(s.base, '/api/auth/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'jane@example.com');
    assert.equal(me.body.user.role, 'user');
  });

  test('GET /api/auth/me without a session is 401', async () => {
    const r = await api(s.base, '/api/auth/me');
    assert.equal(r.status, 401);
  });

  test('logout destroys the session', async () => {
    const login = await api(
      s.base,
      '/api/auth/login',
      postJson({ email: 'jane@example.com', password: 'correct-horse-1' })
    );
    const cookie = cookieOf(login);
    const out = await api(s.base, '/api/auth/logout', { method: 'POST', headers: { cookie } });
    assert.equal(out.status, 200);
    const me = await api(s.base, '/api/auth/me', { headers: { cookie } });
    assert.equal(me.status, 401);
  });

  test('regular users cannot read the admin summary', async () => {
    const login = await api(
      s.base,
      '/api/auth/login',
      postJson({ email: 'jane@example.com', password: 'correct-horse-1' })
    );
    const r = await api(s.base, '/api/dashboard/summary', { headers: { cookie: cookieOf(login) } });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'FORBIDDEN');
  });
});

describe('admin session access', () => {
  let s;
  let adminCookie;
  before(async () => {
    s = await startTestServer({
      config: { ADMIN_EMAIL: 'root@test.dev', ADMIN_PASSWORD: 'root-pass-123' },
    });
    const login = await api(
      s.base,
      '/api/auth/login',
      postJson({ email: 'root@test.dev', password: 'root-pass-123' })
    );
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'admin');
    adminCookie = cookieOf(login);
  });
  after(async () => s.close());

  test('dashboard summary returns live counts for the admin', async () => {
    const r = await api(s.base, '/api/dashboard/summary', { headers: { cookie: adminCookie } });
    assert.equal(r.status, 200);
    assert.ok(r.body.users >= 1);
    assert.equal(r.body.messagesTotal, 0);
    assert.equal(r.body.messagesUnread, 0);
    assert.equal(r.body.plans, 3);
  });

  test('users list never leaks password hashes', async () => {
    const r = await api(s.base, '/api/dashboard/users', { headers: { cookie: adminCookie } });
    assert.equal(r.status, 200);
    const users = r.body.users;
    assert.ok(users.length >= 1);
    for (const u of users) {
      assert.ok(!('passwordHash' in u), 'password hash must never leak');
      assert.ok(!('password_hash' in u), 'password hash must never leak');
      for (const key of ['id', 'name', 'email', 'role', 'createdAt']) {
        assert.ok(key in u, `user object should include ${key}`);
      }
    }
  });

  test('messages API accepts an admin session cookie (no X-Admin-Key)', async () => {
    const r = await api(s.base, '/api/messages', { headers: { cookie: adminCookie } });
    assert.equal(r.status, 200);
    assert.equal(Array.isArray(r.body.messages), true);
  });

  test('messages API still rejects anonymous calls', async () => {
    const r = await api(s.base, '/api/messages');
    assert.equal(r.status, 401);
  });
});

describe('dashboard page guard', () => {
  let s;
  before(async () => {
    s = await startTestServer({
      staticRoot: PROJECT_ROOT,
      config: { ADMIN_EMAIL: 'root@test.dev', ADMIN_PASSWORD: 'root-pass-123' },
    });
  });
  after(async () => s.close());

  test('GET /dashboard.html redirects anonymous visitors to the login page', async () => {
    // Browsers send Accept: text/html — that is what triggers the redirect.
    const res = await fetch(`${s.base}/dashboard.html`, {
      redirect: 'manual',
      headers: { accept: 'text/html' },
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/login.html?next=%2Fdashboard.html');
  });

  test('GET /dashboard serves the page to signed-in users', async () => {
    const login = await api(
      s.base,
      '/api/auth/login',
      postJson({ email: 'root@test.dev', password: 'root-pass-123' })
    );
    const res = await fetch(`${s.base}/dashboard`, {
      headers: { cookie: cookieOf(login) },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>Dashboard — Be Personal Trainer<\/title>/);
  });
});
