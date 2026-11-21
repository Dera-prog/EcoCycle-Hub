-- Up Migration
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  persona TEXT NOT NULL DEFAULT 'new',
  tier TEXT NOT NULL DEFAULT 'New Recycler',
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  pending BIGINT NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  total_recycled INTEGER NOT NULL DEFAULT 0,
  month_kg INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_accounts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  last4 TEXT NOT NULL DEFAULT ''
);

CREATE TABLE categories (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate INTEGER NOT NULL CHECK (rate >= 0)
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL REFERENCES categories(key),
  company TEXT NOT NULL,
  date_label TEXT NOT NULL,
  time TEXT NOT NULL,
  weight NUMERIC(8,2) NOT NULL CHECK (weight > 0 and weight <= 500),
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  earning INTEGER,
  pickup_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  date_label TEXT NOT NULL,
  weight NUMERIC(8,2),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  time_label TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX collections_user_idx ON collections(user_id);
CREATE INDEX payments_user_idx ON payments(user_id);
CREATE INDEX notifications_user_idx ON notifications(user_id);

INSERT INTO categories (key, name, rate) VALUES
  ('plastic', 'Plastic', 80),
  ('paper', 'Paper', 40),
  ('glass', 'Glass', 30),
  ('metal', 'Metal', 120),
  ('organic', 'Organic', 20),
  ('construction', 'Construction', 25),
  ('textile', 'Textile', 50),
  ('electronic', 'Electronic', 200)
ON CONFLICT (key) DO NOTHING;

-- Down Migration
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS bank_accounts;
DROP TABLE IF EXISTS users;
