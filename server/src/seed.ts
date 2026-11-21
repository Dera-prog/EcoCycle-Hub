import bcrypt from 'bcryptjs';
import { pool } from './db.js';

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

export async function seedDemoData(): Promise<void> {
  const { rows } = await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash('demo1234', 10);
    const user = await client.query<{ id: string }>(
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
    console.log('Seeded demo account amaka@gmail.com');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
