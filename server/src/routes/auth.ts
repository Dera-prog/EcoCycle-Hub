import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { findUserByEmail, snapshotFor, pool } from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { platformAccount, postLedger, userAccounts, walletBalances } from '../ledger.js';
import { normalizePhone } from '../phone.js';
import { settlePayout, type PayoutRow } from '../payouts.js';

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
const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: SignUpBody }>('/api/auth/signup', authRateLimit, async (request, reply) => {
    const name = (request.body.name ?? '').trim();
    const email = (request.body.email ?? '').trim().toLowerCase();
    const phone = normalizePhone(request.body.phone ?? '');
    const password = request.body.password ?? '';

    if (name.length < 2) return reply.code(400).send({ error: 'Please enter your full name.' });
    if (!EMAIL_RE.test(email)) return reply.code(400).send({ error: 'Enter a valid email address.' });
    if (!phone) {
      return reply.code(400).send({ error: 'Enter a valid Nigerian phone number.' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await findUserByEmail(email);
    if (existing) return reply.code(409).send({ error: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    let userId: string;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (name, email, phone, password_hash, persona, tier)
         VALUES ($1, $2, $3, $4, 'new', 'New Recycler') RETURNING id`,
        [name, email, phone, hash],
      );
      userId = rows[0].id;
      await client.query('INSERT INTO bank_accounts (user_id, bank_name, last4) VALUES ($1, $2, $3)', [
        userId,
        'No payout account',
        '',
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) {
        const constraint = (error as { constraint?: string }).constraint;
        return reply.code(409).send({
          error:
            constraint === 'users_phone_key'
              ? 'An account with this phone number already exists.'
              : 'An account with this email already exists.',
        });
      }
      throw error;
    } finally {
      client.release();
    }

    const state = await snapshotFor(userId);
    return reply.send({ token: signToken(userId), state });
  });

  app.post<{ Body: SignInBody }>('/api/auth/signin', authRateLimit, async (request, reply) => {
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
      // Open payouts hold real money; close them first so the reset can zero
      // every balance without stranding funds in the clearing account.
      const open = await client.query<PayoutRow>(
        `SELECT * FROM payouts WHERE user_id = $1 AND status IN ('pending', 'processing') FOR UPDATE`,
        [userId],
      );
      for (const payout of open.rows) {
        await settlePayout(client, payout, 'failed', 'Demo reset');
      }

      const { available, pending } = await walletBalances(client, userId);
      if (available > 0 || pending > 0) {
        const accounts = await userAccounts(client, userId);
        const funder = await platformAccount(client, 'platform_earnings');
        const legs = [
          ...(available > 0
            ? [{ accountId: accounts.wallet, direction: 'debit' as const, amount: available }]
            : []),
          ...(pending > 0
            ? [{ accountId: accounts.pending, direction: 'debit' as const, amount: pending }]
            : []),
          { accountId: funder, direction: 'credit' as const, amount: available + pending },
        ];
        await postLedger(client, { type: 'demo_reset', id: userId, memo: 'Demo reset' }, legs);
      }

      await client.query('DELETE FROM collections WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM payments WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM payouts WHERE user_id = $1', [userId]);
      await client.query(
        `UPDATE users SET persona = 'new', tier = 'New Recycler',
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
