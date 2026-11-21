import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { findUserByEmail, snapshotFor, pool } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

interface SignUpBody {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

interface SignInBody {
  email?: string;
  password?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: SignUpBody }>('/api/auth/signup', async (request, reply) => {
    const name = (request.body.name ?? '').trim();
    const email = (request.body.email ?? '').trim().toLowerCase();
    const phone = (request.body.phone ?? '').trim();
    const password = request.body.password ?? '';

    if (name.length < 2) return reply.code(400).send({ error: 'Please enter your full name.' });
    if (!EMAIL_RE.test(email)) return reply.code(400).send({ error: 'Enter a valid email address.' });
    if (phone.replace(/\D/g, '').length < 10) {
      return reply.code(400).send({ error: 'Enter a valid Nigerian phone number.' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await findUserByEmail(email);
    if (existing) return reply.code(409).send({ error: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, persona, tier)
       VALUES ($1, $2, $3, $4, 'new', 'New Recycler') RETURNING id`,
      [name, email, phone, hash],
    );
    const userId = rows[0].id as string;
    await pool.query('INSERT INTO bank_accounts (user_id, bank_name, last4) VALUES ($1, $2, $3)', [
      userId,
      'No payout account',
      '',
    ]);

    const state = await snapshotFor(userId);
    return reply.send({ token: signToken(userId), state });
  });

  app.post<{ Body: SignInBody }>('/api/auth/signin', async (request, reply) => {
    const email = (request.body.email ?? '').trim().toLowerCase();
    const password = request.body.password ?? '';
    const user = await findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Incorrect email or password.' });
    }
    const state = await snapshotFor(user.id);
    return reply.send({ token: signToken(user.id), state });
  });

  app.get('/api/me', { preHandler: requireAuth }, async (request, reply) => {
    const state = await snapshotFor(request.userId!);
    if (!state) return reply.code(404).send({ error: 'Account not found.' });
    return reply.send({ state });
  });

  app.post('/api/demo/reset', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId!;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM collections WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM payments WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
      await client.query(
        `UPDATE users SET persona = 'new', tier = 'New Recycler', balance = 0, pending = 0,
         total_earned = 0, total_recycled = 0, month_kg = 0 WHERE id = $1`,
        [userId],
      );
      await client.query(`UPDATE bank_accounts SET bank_name = 'No payout account', last4 = '' WHERE user_id = $1`, [
        userId,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return reply.send({ state: await snapshotFor(userId) });
  });
}
