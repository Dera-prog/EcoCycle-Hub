import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { pool, findUserById, snapshotFor } from '../db.js';
import { requireAuth } from '../auth.js';

interface WithdrawBody {
  amount?: number;
}

interface BankBody {
  bankName?: string;
  last4?: string;
}

export default async function walletRoutes(app: FastifyInstance) {
  app.post<{ Body: WithdrawBody }>('/api/wallet/withdraw', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId!;
    const amount = Math.round(Number(request.body.amount ?? 0));
    const user = await findUserById(userId);
    if (!user) return reply.code(404).send({ error: 'Account not found.' });

    const balance = Number(user.balance);
    if (!(amount > 0)) return reply.code(400).send({ error: 'Enter an amount to withdraw.' });
    if (amount > balance) return reply.code(400).send({ error: 'Amount exceeds your available balance.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Conditional update keeps concurrent withdrawals from overdrawing the balance.
      const debit = await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
        [amount, userId],
      );
      if (debit.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'Amount exceeds your available balance.' });
      }
      await client.query(
        `INSERT INTO payments (id, user_id, company, date_label, weight, amount, status)
         VALUES ($1, $2, 'Bank withdrawal', 'Today', NULL, $3, 'Paid')`,
        [`pay-${randomUUID()}`, userId, amount],
      );
      await client.query(
        `INSERT INTO notifications (id, user_id, kind, title, body, time_label)
         VALUES ($1, $2, 'payment', 'Withdrawal sent', $3, 'Just now')`,
        [`n-${randomUUID()}`, userId, `₦${amount.toLocaleString('en-NG')} is on its way to your bank.`],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return reply.send({ state: await snapshotFor(userId) });
  });

  app.put<{ Body: BankBody }>('/api/bank-account', { preHandler: requireAuth }, async (request, reply) => {
    const bankName = (request.body.bankName ?? '').trim();
    const last4 = (request.body.last4 ?? '').trim();
    if (!bankName) return reply.code(400).send({ error: 'Enter a bank name.' });
    await pool.query(
      `INSERT INTO bank_accounts (user_id, bank_name, last4) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET bank_name = EXCLUDED.bank_name, last4 = EXCLUDED.last4`,
      [request.userId!, bankName, last4],
    );
    return reply.send({ state: await snapshotFor(request.userId!) });
  });

  app.post('/api/notifications/read-all', { preHandler: requireAuth }, async (request, reply) => {
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [request.userId!]);
    return reply.send({ state: await snapshotFor(request.userId!) });
  });
}
