import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://ecocycle:ecocycle@localhost:5436/ecocycle',
  max: 10,
});

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  persona: 'returning' | 'new';
  tier: string;
  balance: string;
  pending: string;
  total_earned: string;
  total_recycled: string;
  month_kg: string;
  created_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  persona TEXT NOT NULL DEFAULT 'new',
  tier TEXT NOT NULL DEFAULT 'New Recycler',
  balance BIGINT NOT NULL DEFAULT 0,
  pending BIGINT NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  total_recycled INTEGER NOT NULL DEFAULT 0,
  month_kg INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  last4 TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS categories (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL REFERENCES categories(key),
  company TEXT NOT NULL,
  date_label TEXT NOT NULL,
  time TEXT NOT NULL,
  weight NUMERIC(8,2) NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  earning INTEGER,
  pickup_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  date_label TEXT NOT NULL,
  weight NUMERIC(8,2),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  time_label TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collections_user_idx ON collections(user_id);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
`;

const CATEGORIES: Array<[string, string, number]> = [
  ['plastic', 'Plastic', 80],
  ['paper', 'Paper', 40],
  ['glass', 'Glass', 30],
  ['metal', 'Metal', 120],
  ['organic', 'Organic', 20],
  ['construction', 'Construction', 25],
  ['textile', 'Textile', 50],
  ['electronic', 'Electronic', 200],
];

const SEED_COLLECTIONS = [
  ['pc-8821', 'plastic', 'GreenCycle Ltd', 'Today', '2:00 PM', 4.5, '12 Okota Road, Lagos', 'upcoming', null, '#PC-8821'],
  ['pw-8830', 'paper', 'EcoVerde Co.', 'Fri 20', '10:00 AM', 3.2, '12 Okota Road, Lagos', 'upcoming', null, '#PC-8830'],
  ['mw-8790', 'metal', 'RecyTech NG', 'Dec 14', '12:00 PM', 2.1, '12 Okota Road, Lagos', 'completed', 252, null],
  ['pw-8760', 'paper', 'EcoVerde Co.', 'Dec 12', '8:00 AM', 6.8, '12 Okota Road, Lagos', 'completed', 272, null],
  ['ew-8741', 'electronic', 'E-Recycle Hub', 'Dec 10', '4:00 PM', 1.2, '12 Okota Road, Lagos', 'completed', 240, null],
] as const;

const SEED_PAYMENTS = [
  ['pay1', 'GreenCycle Ltd', 'Dec 1, 2024', 155, 12400, 'Paid'],
  ['pay2', 'RecyTech NG', 'Sep 1, 2024', 131, 10500, 'Paid'],
  ['pay3', 'EcoVerde Co.', 'Jun 1, 2024', 114, 9100, 'Paid'],
  ['pay4', 'EcoVerde Co.', 'Pending', 33, 2640, 'Pending'],
] as const;

const SEED_NOTIFICATIONS = [
  ['n1', 'pickup', 'Pickup confirmed!', 'GreenCycle Ltd arrives today at 2:00 PM.', '2m ago', false],
  ['n2', 'payment', 'Payment received', '₦12,400 credited for December.', '1h ago', false],
  ['n3', 'tip', 'New recycling tip', 'Remove bottle caps before sorting.', '3h ago', true],
  ['n4', 'badge', 'Gold Recycler unlocked 🥇', 'You crossed 1,000 kg. Congrats!', '2d ago', true],
] as const;

export async function migrateAndSeed(): Promise<void> {
  await pool.query(SCHEMA);

  for (const [key, name, rate] of CATEGORIES) {
    await pool.query(
      'INSERT INTO categories (key, name, rate) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, rate = EXCLUDED.rate',
      [key, name, rate],
    );
  }

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash('demo1234', 10);
    const user = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, persona, tier, balance, pending, total_earned, total_recycled, month_kg)
       VALUES ($1, $2, $3, $4, 'returning', 'Gold Recycler', 48200, 2640, 48200, 1240, 89)
       RETURNING id`,
      ['Amaka Obi', 'amaka@gmail.com', '0803 555 0192', passwordHash],
    );
    const userId = user.rows[0].id;

    await client.query('INSERT INTO bank_accounts (user_id, bank_name, last4) VALUES ($1, $2, $3)', [
      userId,
      'First Bank Nigeria',
      '4721',
    ]);

    for (const c of SEED_COLLECTIONS) {
      await client.query(
        `INSERT INTO collections (id, user_id, category, company, date_label, time, weight, address, status, earning, pickup_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [c[0], userId, c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9]],
      );
    }

    for (const p of SEED_PAYMENTS) {
      await client.query(
        `INSERT INTO payments (id, user_id, company, date_label, weight, amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p[0], userId, p[1], p[2], p[3], p[4], p[5]],
      );
    }

    for (const n of SEED_NOTIFICATIONS) {
      await client.query(
        `INSERT INTO notifications (id, user_id, kind, title, body, time_label, read)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [n[0], userId, n[1], n[2], n[3], n[4], n[5]],
      );
    }

    await client.query('COMMIT');
    console.log('Seeded demo user amaka@gmail.com');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export interface Snapshot {
  persona: 'returning' | 'new';
  user: { name: string; email: string; tier: string };
  balance: number;
  pending: number;
  totalEarned: number;
  totalRecycled: number;
  monthKg: number;
  collections: unknown[];
  notifications: unknown[];
  payments: unknown[];
  bank: { name: string; last4: string };
}

export async function snapshotFor(userId: string): Promise<Snapshot | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const [bank, collections, notifications, payments] = await Promise.all([
    pool.query('SELECT bank_name, last4 FROM bank_accounts WHERE user_id = $1', [userId]),
    pool.query(
      `SELECT id, category, company, date_label, time, weight, address, status, earning, pickup_id
       FROM collections WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT id, kind, title, body, time_label, read FROM notifications
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT id, company, date_label, weight, amount, status FROM payments
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    ),
  ]);

  return {
    persona: user.persona,
    user: { name: user.name, email: user.email, tier: user.tier },
    balance: Number(user.balance),
    pending: Number(user.pending),
    totalEarned: Number(user.total_earned),
    totalRecycled: Number(user.total_recycled),
    monthKg: Number(user.month_kg),
    collections: collections.rows.map((r) => ({
      id: r.id,
      category: r.category,
      company: r.company,
      dateLabel: r.date_label,
      time: r.time,
      weight: Number(r.weight),
      address: r.address,
      status: r.status,
      ...(r.earning !== null ? { earning: r.earning } : {}),
      ...(r.pickup_id ? { pickupId: r.pickup_id } : {}),
    })),
    notifications: notifications.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      time: r.time_label,
      read: r.read,
    })),
    payments: payments.rows.map((r) => ({
      id: r.id,
      company: r.company,
      dateLabel: r.date_label,
      weight: r.weight === null ? null : Number(r.weight),
      amount: r.amount,
      status: r.status,
    })),
    bank: bank.rows[0]
      ? { name: bank.rows[0].bank_name, last4: bank.rows[0].last4 }
      : { name: 'No payout account', last4: '' },
  };
}
