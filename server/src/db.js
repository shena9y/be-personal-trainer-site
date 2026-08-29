import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { seedDefaults } from './seed.js';

export const MESSAGE_STATUSES = new Set(['unread', 'read', 'archived']);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  tagline       TEXT    NOT NULL DEFAULT '',
  price_monthly INTEGER NOT NULL,               -- cents
  price_yearly  INTEGER NOT NULL,               -- cents
  accent        TEXT    NOT NULL DEFAULT '',    -- '' | 'orange' | 'purple'
  sort_order    INTEGER NOT NULL DEFAULT 0,
  features      TEXT    NOT NULL DEFAULT '[]',  -- JSON: [{ text, included }]
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    NOT NULL UNIQUE,
  label      TEXT    NOT NULL,
  value      REAL    NOT NULL,
  decimals   INTEGER NOT NULL DEFAULT 0,
  suffix     TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  subject    TEXT    NOT NULL DEFAULT '',
  message    TEXT    NOT NULL,
  plan       TEXT    NOT NULL DEFAULT '',   -- the plan the visitor asked about
  ip         TEXT,
  user_agent TEXT,
  status     TEXT    NOT NULL DEFAULT 'unread',  -- unread | read | archived
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_status  ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON contact_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user',  -- user | admin
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT    NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
`;

/**
 * Additive migrations for databases that were created before a column existed.
 * `CREATE TABLE IF NOT EXISTS` never touches an existing table, so older
 * databases get their missing columns added here.
 */
function migrateIfNeeded(db) {
  const cols = db
    .prepare('PRAGMA table_info(contact_messages)')
    .all()
    .map((c) => c.name);
  if (!cols.includes('plan')) {
    db.exec("ALTER TABLE contact_messages ADD COLUMN plan TEXT NOT NULL DEFAULT ''");
  }
}

/**
 * Open (and migrate) a SQLite database and return a hand-off object with
 * the raw connection plus a small query API for the rest of the app.
 * `options.adminEmail`/`options.adminPassword` bootstrap the first (admin)
 * account when the users table is empty.
 */
export function openDatabase(databasePath = ':memory:', options = {}) {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrateIfNeeded(db);
  seedDefaults(db, options);
  const queries = dbQueries(db);

  return { db, queries };
}

export function dbQueries(db) {
  const plansAll = db.prepare('SELECT * FROM plans ORDER BY sort_order ASC, id ASC');
  const statsAll = db.prepare('SELECT * FROM stats ORDER BY sort_order ASC, id ASC');

  const insertMessage = db.prepare(`
    INSERT INTO contact_messages (name, email, subject, message, plan, ip, user_agent, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'unread', ?)
  `);
  const messageById = db.prepare('SELECT * FROM contact_messages WHERE id = ?');
  const messagesList = db.prepare(`
    SELECT * FROM contact_messages
    WHERE (? IS NULL OR status = ?)
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `);
  const messagesCount = db.prepare('SELECT COUNT(*) AS n FROM contact_messages WHERE (? IS NULL OR status = ?)');
  const messageSetStatus = db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?');
  const messageDelete = db.prepare('DELETE FROM contact_messages WHERE id = ?');

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const userByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const userById = db.prepare('SELECT * FROM users WHERE id = ?');
  const insertSession = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const sessionByToken = db.prepare('SELECT * FROM sessions WHERE token = ?');
  const sessionDelete = db.prepare('DELETE FROM sessions WHERE token = ?');
  const usersCount = db.prepare('SELECT COUNT(*) AS n FROM users');
  const usersList = db.prepare('SELECT * FROM users ORDER BY created_at ASC, id ASC');

  const toPlan = (row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    priceMonthly: row.price_monthly / 100,
    priceYearly: row.price_yearly / 100,
    accent: row.accent || null,
    features: JSON.parse(row.features || '[]'),
  });

  const toStat = (row) => ({
    slug: row.slug,
    label: row.label,
    value: row.value,
    decimals: row.decimals,
    suffix: row.suffix,
  });

  const toMessage = (row) => ({
    id: Number(row.id),
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    plan: row.plan || '',
    status: row.status,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  });

  const toUser = (row) => ({
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  });

  return {
    listPlans: () => plansAll.all().map(toPlan),
    listStats: () => statsAll.all().map(toStat),

    insertMessage: ({ name, email, subject, message, plan, ip, userAgent }) =>
      Number(
        insertMessage.run(
          name,
          email,
          subject,
          message,
          plan || '',
          ip,
          userAgent,
          new Date().toISOString()
        ).lastInsertRowid
      ),
    getMessage: (id) => {
      const row = messageById.get(id);
      return row ? toMessage(row) : null;
    },
    listMessages: ({ status = null, limit = 50, offset = 0 } = {}) => {
      const s = status && MESSAGE_STATUSES.has(status) ? status : null;
      return {
        messages: messagesList.all(s, s, limit, offset).map(toMessage),
        total: Number(messagesCount.get(s, s).n || 0),
      };
    },
    updateMessageStatus: (id, status) => {
      const result = messageSetStatus.run(status, id);
      if (result.changes === 0) return null;
      return toMessage(messageById.get(id));
    },
    deleteMessage: (id) => messageDelete.run(id).changes > 0,

    // ---- users & sessions ----
    countMessages: (status = null) => {
      const s = status && MESSAGE_STATUSES.has(status) ? status : null;
      return Number(messagesCount.get(s, s).n || 0);
    },
    createUser: ({ name, email, passwordHash, role }) =>
      Number(
        insertUser.run(name, email, passwordHash, role || 'user', new Date().toISOString()).lastInsertRowid
      ),
    getUserByEmail: (email) => {
      const row = userByEmail.get(String(email ?? '').toLowerCase());
      // Internal shape — includes passwordHash so credential checks work.
      // Never send this object to the client; wrap it in startSession() or
      // use the public listUsers()/session shapes instead.
      return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
    },
    getUserById: (id) => {
      const row = userById.get(id);
      return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
    },
    countUsers: () => Number(usersCount.get().n || 0),
    listUsers: () => usersList.all().map(toUser),
    createSession: ({ token, userId, expiresAt }) =>
      Number(
        insertSession.run(token, userId, expiresAt, new Date().toISOString()).lastInsertRowid
      ),
    /** Return a session with its user, or null. Expired sessions are not deleted here. */
    getSession: (token) => {
      const row = sessionByToken.get(token);
      if (!row) return null;
      return {
        id: Number(row.id),
        token: row.token,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        user: toUser(userById.get(row.user_id)),
      };
    },
    deleteSession: (token) => sessionDelete.run(token).changes > 0,
  };
}