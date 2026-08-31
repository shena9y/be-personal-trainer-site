import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { hashPasswordSync } from './auth.js';

/**
 * Default content, matching the copy and pricing on the live site exactly.
 * Inserted only when a table is empty, so admin edits are never overwritten.
 */
const PLANS = [
  {
    slug: 'basic',
    name: 'Basic',
    tagline: 'Self-guided plan with monthly check-ins.',
    priceMonthly: 3900, // $39
    priceYearly: 3100,  // $31
    accent: '',
    features: [
      { text: 'Monthly training plan', included: true },
      { text: 'Weekly video review', included: false },
      { text: '1:1 sessions', included: false },
    ],
  },
  {
    slug: 'professional',
    name: 'Professional',
    tagline: 'Coaching with weekly feedback loops.',
    priceMonthly: 5900, // $59
    priceYearly: 4700,  // $47
    accent: 'orange',
    features: [
      { text: 'Weekly training plan', included: true },
      { text: 'Weekly video review', included: true },
      { text: '1:1 sessions', included: false },
    ],
  },
  {
    slug: 'advanced',
    name: 'Advanced',
    tagline: 'Full programme with in-person work.',
    priceMonthly: 8900, // $89
    priceYearly: 7100,  // $71
    accent: 'purple',
    features: [
      { text: 'Weekly training plan', included: true },
      { text: 'Weekly video review', included: true },
      { text: '4 × 1:1 sessions', included: true },
    ],
  },
];

const STATS = [
  { slug: 'years-coaching', label: 'Years coaching', value: 12, decimals: 0, suffix: '+' },
  { slug: 'athletes-coached', label: 'Athletes coached', value: 500, decimals: 0, suffix: '+' },
  { slug: 'sessions-delivered', label: 'Sessions delivered', value: 15000, decimals: 0, suffix: '+' },
  { slug: 'client-rating', label: 'Average client rating', value: 4.9, decimals: 1, suffix: '★' },
];

export function seedDefaults(db, options = {}) {
  const now = new Date().toISOString();

  if (db.prepare('SELECT COUNT(*) AS n FROM plans').get().n === 0) {
    const insert = db.prepare(`
      INSERT INTO plans (slug, name, tagline, price_monthly, price_yearly, accent, sort_order, features, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    PLANS.forEach((plan, index) => {
      insert.run(
        plan.slug,
        plan.name,
        plan.tagline,
        plan.priceMonthly,
        plan.priceYearly,
        plan.accent,
        index,
        JSON.stringify(plan.features),
        now,
        now
      );
    });
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM stats').get().n === 0) {
    const insert = db.prepare(`
      INSERT INTO stats (slug, label, value, decimals, suffix, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    STATS.forEach((stat, index) => {
      insert.run(stat.slug, stat.label, stat.value, stat.decimals, stat.suffix, index);
    });
  }

  // Bootstrap the first admin account from env when the users table is empty.
  // Signups always create 'user' accounts; promote to admin via env
  // (ADMIN_EMAIL + ADMIN_PASSWORD) or directly in the database.
  const { adminEmail, adminPassword } = options;
  if (adminEmail && adminPassword) {
    const email = String(adminEmail).trim().toLowerCase();
    if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
      db.prepare(`
        INSERT INTO users (name, email, password_hash, role, created_at)
        VALUES (?, ?, ?, 'admin', ?)
      `).run('Administrator', email, hashPasswordSync(adminPassword), now);
      console.log(`[seed] Created admin account for ${email}`);
    }
  }
}

// Allow `npm run seed` to (re)seed an existing database file.
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1]) {
  const { default: pathModule } = await import('node:path');
  if (pathModule.resolve(process.argv[1]) === __filename) {
    const raw = process.env.DATABASE_PATH || './data/fit-site.sqlite';
    const resolvedPath =
      raw === ':memory:' ? raw : pathModule.resolve(dirname(__filename), '..', raw);
    const { db } = openDatabase(resolvedPath);
    console.log(`Seeded default plans and stats into ${resolvedPath}`);
    db.close();
  }
}