-- Up Migration

-- Every naira is a row. Balances become a sum of ledger entries instead of a
-- column that can drift.
CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('wallet', 'pending', 'platform_earnings', 'platform_payouts', 'platform_bank')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind IN ('wallet', 'pending')) = (user_id IS NOT NULL))
);

CREATE UNIQUE INDEX ledger_accounts_user_kind_idx ON ledger_accounts (user_id, kind) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_accounts_platform_kind_idx ON ledger_accounts (kind) WHERE user_id IS NULL;

INSERT INTO ledger_accounts (kind) VALUES ('platform_earnings'), ('platform_payouts'), ('platform_bank');

CREATE TABLE ledger_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  txn_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  memo TEXT NOT NULL,
  ref_type TEXT NOT NULL,
  ref_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ledger_entries_account_idx ON ledger_entries (account_id);
CREATE INDEX ledger_entries_txn_idx ON ledger_entries (txn_id);
CREATE INDEX ledger_entries_ref_idx ON ledger_entries (ref_type, ref_id);

-- One wallet and one pending account per existing user.
INSERT INTO ledger_accounts (kind, user_id)
SELECT kinds.kind, u.id
FROM users u
CROSS JOIN (VALUES ('wallet'), ('pending')) AS kinds(kind)
ON CONFLICT DO NOTHING;

-- Opening balances: what the old columns said becomes a balanced pair of
-- entries against platform earnings.
WITH opening AS (
  SELECT u.id AS user_id, u.balance, u.pending, gen_random_uuid() AS txn_id
  FROM users u
  WHERE u.balance > 0 OR u.pending > 0
)
INSERT INTO ledger_entries (txn_id, account_id, direction, amount, memo, ref_type, ref_id)
SELECT o.txn_id, a.id, 'debit', o.balance + o.pending, 'Opening balance', 'opening', o.user_id::text
FROM opening o
JOIN ledger_accounts a ON a.kind = 'platform_earnings' AND a.user_id IS NULL
UNION ALL
SELECT o.txn_id, a.id, 'credit', o.balance, 'Opening balance', 'opening', o.user_id::text
FROM opening o
JOIN ledger_accounts a ON a.user_id = o.user_id AND a.kind = 'wallet'
WHERE o.balance > 0
UNION ALL
SELECT o.txn_id, a.id, 'credit', o.pending, 'Opening balance', 'opening', o.user_id::text
FROM opening o
JOIN ledger_accounts a ON a.user_id = o.user_id AND a.kind = 'pending'
WHERE o.pending > 0;

ALTER TABLE users DROP COLUMN balance;
ALTER TABLE users DROP COLUMN pending;

CREATE TABLE payouts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  provider TEXT NOT NULL,
  provider_ref TEXT,
  failure_reason TEXT,
  bank_name TEXT NOT NULL DEFAULT '',
  bank_last4 TEXT NOT NULL DEFAULT '',
  request_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX payouts_user_idx ON payouts (user_id);
CREATE INDEX payouts_status_idx ON payouts (status);
CREATE UNIQUE INDEX payouts_provider_ref_idx ON payouts (provider, provider_ref) WHERE provider_ref IS NOT NULL;

CREATE TABLE payment_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payout_id TEXT REFERENCES payouts(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- A payout needs the account number and bank code the provider will send to.
ALTER TABLE bank_accounts ADD COLUMN account_name TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN account_number TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN bank_code TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN verified_at TIMESTAMPTZ;

-- Down Migration

ALTER TABLE bank_accounts DROP COLUMN verified_at;
ALTER TABLE bank_accounts DROP COLUMN bank_code;
ALTER TABLE bank_accounts DROP COLUMN account_number;
ALTER TABLE bank_accounts DROP COLUMN account_name;

DROP TABLE payment_events;
DROP TABLE payouts;

ALTER TABLE users ADD COLUMN balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0);
ALTER TABLE users ADD COLUMN pending BIGINT NOT NULL DEFAULT 0;

UPDATE users u SET balance = COALESCE((
  SELECT SUM(CASE e.direction WHEN 'credit' THEN e.amount ELSE -e.amount END)
  FROM ledger_entries e JOIN ledger_accounts a ON a.id = e.account_id
  WHERE a.user_id = u.id AND a.kind = 'wallet'
), 0);
UPDATE users u SET pending = COALESCE((
  SELECT SUM(CASE e.direction WHEN 'credit' THEN e.amount ELSE -e.amount END)
  FROM ledger_entries e JOIN ledger_accounts a ON a.id = e.account_id
  WHERE a.user_id = u.id AND a.kind = 'pending'
), 0);

DROP TABLE ledger_entries;
DROP TABLE ledger_accounts;
