import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { pool, findUserById, snapshotFor } from '../db.js';
import { requireAuth } from '../auth.js';
import { platformAccount, postLedger, userAccounts, walletBalances } from '../ledger.js';
import { payoutsConfigured } from '../payments.js';
import { payoutPaymentId, startPayoutTransfer } from '../payouts.js';

interface WithdrawBody {
  amount?: number;
  requestKey?: string;
}

interface BankBody {
  bankName?: string;
  last4?: string;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
}

interface BankRow {
  bank_name: string;
  last4: string;
  account_number: string;
  bank_code: string;
  account_name: string;
}

export default async function walletRoutes(app: FastifyInstance) {
  app.post<{ Body: WithdrawBody }>('/api/wallet/withdraw', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId!;
    const amount = Math.round(Number(request.body.amount ?? 0));
    const requestKey = (request.body.requestKey ?? '').trim() || null;
    const user = await findUserById(userId);
    if (!user) return reply.code(404).send({ error: 'Account not found.' });
    if (!(amount > 0)) return reply.code(400).send({ error: 'Enter an amount to withdraw.' });
    if (!payoutsConfigured()) {
      return reply.code(503).send({ error: 'Withdrawals are paused until a payout provider is connected.' });
    }

    const bank = await pool.query<BankRow>(
      'SELECT bank_name, last4, account_number, bank_code, account_name FROM bank_accounts WHERE user_id = $1',
      [userId],
    );
    if (!bank.rows[0] || bank.rows[0].last4.length !== 4) {
      return reply.code(400).send({ error: 'Add a payout account before withdrawing.' });
    }

    if (requestKey) {
      const existing = await pool.query('SELECT id FROM payouts WHERE request_key = $1 AND user_id = $2', [
        requestKey,
        userId,
      ]);
      if (existing.rowCount) return reply.send({ state: await snapshotFor(userId) });
    }

    // The hold is committed before the provider is called: a slow network must
    // not keep a customer's row locked, and the payout row is the outbox.
    let payoutId = '';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const balances = await walletBalances(client, userId);
      if (amount > balances.available) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'Amount exceeds your available balance.' });
      }

      const accounts = await userAccounts(client, userId);
      const payoutsAccount = await platformAccount(client, 'platform_payouts');
      payoutId = `payout-${randomUUID()}`;
      await client.query(
        `INSERT INTO payouts (id, user_id, amount, status, provider, bank_name, bank_last4, request_key)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)`,
        [payoutId, userId, amount, config.paymentsProvider, bank.rows[0].bank_name, bank.rows[0].last4, requestKey],
      );
      await postLedger(
        client,
        { type: 'payout_hold', id: payoutId, memo: `Withdrawal ${payoutId}` },
        [
          { accountId: accounts.wallet, direction: 'debit', amount },
          { accountId: payoutsAccount, direction: 'credit', amount },
        ],
      );
      await client.query(
        `INSERT INTO payments (id, user_id, company, date_label, weight, amount, status)
         VALUES ($1, $2, 'Bank withdrawal', 'Today', NULL, $3, 'Pending')`,
        [payoutPaymentId(payoutId), userId, amount],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (requestKey && (error as { code?: string }).code === '23505') {
        return reply.send({ state: await snapshotFor(userId) });
      }
      throw error;
    } finally {
      client.release();
    }

    const started = await startPayoutTransfer(payoutId);
    if (!started.ok) {
      return reply.code(502).send({
        error: `The payout provider rejected the withdrawal: ${started.error}`,
        state: await snapshotFor(userId),
      });
    }
    return reply.send({ state: await snapshotFor(userId) });
  });

  app.put<{ Body: BankBody }>('/api/bank-account', { preHandler: requireAuth }, async (request, reply) => {
    const bankName = (request.body.bankName ?? '').trim();
    const accountNumber = (request.body.accountNumber ?? '').replace(/\D/g, '');
    const bankCode = (request.body.bankCode ?? '').replace(/\D/g, '');
    const accountName = (request.body.accountName ?? '').trim();
    const last4 = (request.body.last4 ?? '').replace(/\D/g, '').slice(-4) || accountNumber.slice(-4);
    if (!bankName) return reply.code(400).send({ error: 'Enter a bank name.' });
    if (accountNumber && accountNumber.length !== 10) {
      return reply.code(400).send({ error: 'Enter the 10-digit account number.' });
    }
    if (config.paymentsProvider === 'paystack' && (!accountNumber || !bankCode)) {
      return reply.code(400).send({ error: 'Payouts need the full account number and the bank code.' });
    }
    await pool.query(
      `INSERT INTO bank_accounts (user_id, bank_name, last4, account_number, bank_code, account_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET bank_name = EXCLUDED.bank_name, last4 = EXCLUDED.last4,
         account_number = EXCLUDED.account_number, bank_code = EXCLUDED.bank_code,
         account_name = EXCLUDED.account_name`,
      [request.userId!, bankName, last4, accountNumber, bankCode, accountName],
    );
    return reply.send({ state: await snapshotFor(request.userId!) });
  });

  app.post('/api/notifications/read-all', { preHandler: requireAuth }, async (request, reply) => {
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [request.userId!]);
    return reply.send({ state: await snapshotFor(request.userId!) });
  });
}
