import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  application_name: 'ecocycle-api',
});

pool.on('error', (error) => {
  console.error('Unexpected idle database client error', error);
});

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  password_hash: string;
  role: 'customer' | 'agent' | 'depot' | 'admin';
  persona: 'returning' | 'new';
  tier: string;
  balance: string;
  pending: string;
  total_earned: string;
  total_recycled: string;
  month_kg: string;
  created_at: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE phone = $1', [phone]);
  return rows[0] ?? null;
}

export interface Snapshot {
  persona: 'returning' | 'new';
  user: { name: string; email: string; phone: string; role: UserRow['role']; tier: string };
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
    user: { name: user.name, email: user.email ?? '', phone: user.phone, role: user.role, tier: user.tier },
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
