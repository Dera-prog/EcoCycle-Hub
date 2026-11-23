import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { platformAccount, postLedger, userAccounts } from './ledger.js';
import { notifyCustomer } from './notify.js';
import { createTransfer } from './payments.js';

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface PayoutRow {
  id: string;
  user_id: string;
  amount: string;
  status: PayoutStatus;
  provider: string;
  provider_ref: string | null;
  failure_reason: string | null;
  bank_name: string;
  bank_last4: string;
}

export function payoutPaymentId(payoutId: string): string {
  return `pay-${payoutId}`;
}

/**
 * Closes a processing payout. Paid money leaves through the bank account;
 * a failed transfer refunds the customer's wallet.
 */
export async function settlePayout(
  client: PoolClient,
  payout: PayoutRow,
  outcome: 'paid' | 'failed',
  reason?: string,
): Promise<boolean> {
  // Pending and processing payouts both have money held, so either can be
  // closed exactly once; anything already settled is ignored.
  if (payout.status !== 'processing' && payout.status !== 'pending') return false;

  const amount = Number(payout.amount);
  const payouts = await platformAccount(client, 'platform_payouts');

  const customer = await client.query<{ name: string; phone: string }>(
    'SELECT name, phone FROM users WHERE id = $1',
    [payout.user_id],
  );

  if (outcome === 'paid') {
    const bank = await platformAccount(client, 'platform_bank');
    await postLedger(
      client,
      { type: 'payout', id: payout.id, memo: `Payout ${payout.id} paid` },
      [
        { accountId: payouts, direction: 'debit', amount },
        { accountId: bank, direction: 'credit', amount },
      ],
    );
  } else {
    const { wallet } = await userAccounts(client, payout.user_id);
    await postLedger(
      client,
      { type: 'payout_refund', id: payout.id, memo: `Payout ${payout.id} failed — refunded` },
      [
        { accountId: payouts, direction: 'debit', amount },
        { accountId: wallet, direction: 'credit', amount },
      ],
    );
  }

  await client.query(
    `UPDATE payouts SET status = $1, failure_reason = $2, settled_at = now(), updated_at = now()
     WHERE id = $3`,
    [outcome === 'paid' ? 'paid' : 'failed', outcome === 'paid' ? null : (reason ?? 'Transfer failed'), payout.id],
  );
  await client.query('UPDATE payments SET status = $1 WHERE id = $2', [
    outcome === 'paid' ? 'Paid' : 'Failed',
    payoutPaymentId(payout.id),
  ]);

  const money = `₦${amount.toLocaleString('en-NG')}`;
  await notifyCustomer(client, {
    userId: payout.user_id,
    phone: customer.rows[0]?.phone ?? '',
    title: outcome === 'paid' ? 'Withdrawal paid' : 'Withdrawal failed',
    body:
      outcome === 'paid'
        ? `${money} has been sent to your ${payout.bank_name} account.`
        : `${money} could not be sent to your bank. It is back in your balance — try again or change your account.`,
    sms:
      outcome === 'paid'
        ? `EcoCycle: ${money} payout sent to your bank.`
        : `EcoCycle: your ${money} payout failed and has been returned to your balance.`,
  });

  return true;
}

interface PayoutWithBank extends PayoutRow {
  account_number: string | null;
  bank_code: string | null;
  account_name: string | null;
}

/**
 * A bank can reverse a transfer after it was marked paid. The money leaves
 * the platform's bank account and returns to the customer's wallet.
 */
export async function reversePayout(
  client: PoolClient,
  payout: PayoutRow,
  reason: string,
): Promise<boolean> {
  if (payout.status !== 'paid') return false;

  const amount = Number(payout.amount);
  const bank = await platformAccount(client, 'platform_bank');
  const { wallet } = await userAccounts(client, payout.user_id);
  await postLedger(
    client,
    { type: 'payout_reversal', id: payout.id, memo: `Payout ${payout.id} reversed` },
    [
      { accountId: bank, direction: 'debit', amount },
      { accountId: wallet, direction: 'credit', amount },
    ],
  );

  await client.query(
    `UPDATE payouts SET status = 'failed', failure_reason = $1, updated_at = now() WHERE id = $2`,
    [reason, payout.id],
  );
  await client.query('UPDATE payments SET status = $1 WHERE id = $2', ['Failed', payoutPaymentId(payout.id)]);

  const customer = await client.query<{ phone: string }>('SELECT phone FROM users WHERE id = $1', [payout.user_id]);
  const money = `₦${amount.toLocaleString('en-NG')}`;
  await notifyCustomer(client, {
    userId: payout.user_id,
    phone: customer.rows[0]?.phone ?? '',
    title: 'Withdrawal reversed',
    body: `${money} was reversed by your bank and returned to your balance.`,
    sms: `EcoCycle: your ${money} payout was reversed and is back in your balance.`,
  });

  return true;
}

/**
 * Hands a held payout to the provider. Success moves it to processing; a
 * provider rejection closes it as failed and refunds the wallet.
 */
export async function startPayoutTransfer(payoutId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { rows } = await pool.query<PayoutWithBank>(
    `SELECT po.*, b.account_number, b.bank_code, b.account_name
     FROM payouts po
     LEFT JOIN bank_accounts b ON b.user_id = po.user_id
     WHERE po.id = $1`,
    [payoutId],
  );
  const payout = rows[0];
  if (!payout) return { ok: false, error: 'Payout not found.' };

  const transfer = await createTransfer({
    payoutId: payout.id,
    amount: Number(payout.amount),
    bankName: payout.bank_name,
    bankCode: payout.bank_code ?? '',
    accountNumber: payout.account_number ?? '',
    accountName: payout.account_name ?? '',
  });

  if (transfer.ok) {
    await pool.query(
      `UPDATE payouts SET status = 'processing', provider_ref = $1, updated_at = now() WHERE id = $2`,
      [transfer.reference, payout.id],
    );
    await pool.query('UPDATE payments SET status = $1 WHERE id = $2', ['Processing', payoutPaymentId(payout.id)]);
    return { ok: true };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query<PayoutRow>('SELECT * FROM payouts WHERE id = $1 FOR UPDATE', [payout.id]);
    if (locked.rows[0]) await settlePayout(client, locked.rows[0], 'failed', transfer.error);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { ok: false, error: transfer.error };
}
