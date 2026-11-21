import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

type Queryable = Pool | PoolClient;

export type Direction = 'debit' | 'credit';
export type PlatformKind = 'platform_earnings' | 'platform_payouts' | 'platform_bank';

export interface LedgerLeg {
  accountId: string;
  direction: Direction;
  amount: number;
}

export interface LedgerRef {
  type: string;
  id?: string;
  memo: string;
}

export interface UserAccounts {
  wallet: string;
  pending: string;
}

export async function platformAccount(db: Queryable, kind: PlatformKind): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM ledger_accounts WHERE kind = $1 AND user_id IS NULL',
    [kind],
  );
  if (!rows[0]) throw new Error(`Missing platform ledger account ${kind}`);
  return rows[0].id;
}

export async function userAccounts(db: Queryable, userId: string): Promise<UserAccounts> {
  await db.query(
    `INSERT INTO ledger_accounts (kind, user_id)
     VALUES ('wallet', $1), ('pending', $1)
     ON CONFLICT DO NOTHING`,
    [userId],
  );
  const { rows } = await db.query<{ kind: 'wallet' | 'pending'; id: string }>(
    `SELECT kind, id FROM ledger_accounts WHERE user_id = $1 AND kind IN ('wallet', 'pending')`,
    [userId],
  );
  const accounts = new Map(rows.map((row) => [row.kind, row.id]));
  const wallet = accounts.get('wallet');
  const pending = accounts.get('pending');
  if (!wallet || !pending) throw new Error(`Missing ledger accounts for user ${userId}`);
  return { wallet, pending };
}

/**
 * Writes one balanced transaction. Every call must debit and credit the same
 * total, which is what keeps the books reconcilable.
 */
export async function postLedger(db: Queryable, ref: LedgerRef, legs: LedgerLeg[]): Promise<string> {
  const debits = legs.filter((leg) => leg.direction === 'debit').reduce((sum, leg) => sum + leg.amount, 0);
  const credits = legs.filter((leg) => leg.direction === 'credit').reduce((sum, leg) => sum + leg.amount, 0);
  if (legs.length < 2 || debits !== credits || debits <= 0) {
    throw new Error(`Unbalanced ledger transaction for ${ref.type}: debit ${debits}, credit ${credits}`);
  }

  const txnId = randomUUID();
  for (const leg of legs) {
    if (!Number.isInteger(leg.amount) || leg.amount <= 0) {
      throw new Error(`Invalid ledger amount ${leg.amount}`);
    }
    await db.query(
      `INSERT INTO ledger_entries (txn_id, account_id, direction, amount, memo, ref_type, ref_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [txnId, leg.accountId, leg.direction, leg.amount, ref.memo, ref.type, ref.id ?? null],
    );
  }
  return txnId;
}

export async function accountBalance(db: Queryable, accountId: string): Promise<number> {
  const { rows } = await db.query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount ELSE -amount END), 0)::bigint AS balance
     FROM ledger_entries WHERE account_id = $1`,
    [accountId],
  );
  return Number(rows[0].balance);
}

export async function walletBalances(db: Queryable, userId: string): Promise<{ available: number; pending: number }> {
  const { rows } = await db.query<{ kind: 'wallet' | 'pending'; balance: string }>(
    `SELECT a.kind, COALESCE(SUM(CASE e.direction WHEN 'credit' THEN e.amount ELSE -e.amount END), 0)::bigint AS balance
     FROM ledger_accounts a
     LEFT JOIN ledger_entries e ON e.account_id = a.id
     WHERE a.user_id = $1 AND a.kind IN ('wallet', 'pending')
     GROUP BY a.kind`,
    [userId],
  );
  const balances = new Map(rows.map((row) => [row.kind, Number(row.balance)]));
  return { available: balances.get('wallet') ?? 0, pending: balances.get('pending') ?? 0 };
}
