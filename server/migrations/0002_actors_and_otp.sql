-- Up Migration
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'
  CHECK (role IN ('customer', 'agent', 'depot', 'admin'));
ALTER TABLE users ADD COLUMN phone_verified_at TIMESTAMPTZ;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Phone-first accounts have no email, so normalise what exists before the
-- uniqueness guarantee below is enforced.
UPDATE users
SET phone = '+234' || right(regexp_replace(phone, '\D', '', 'g'), 10)
WHERE regexp_replace(phone, '\D', '', 'g') ~ '^(0)?[789]\d{9}$'
   OR regexp_replace(phone, '\D', '', 'g') ~ '^234[789]\d{9}$';

-- Older seed runs shared one number across accounts. Keep the earliest
-- registration for each number and clear the rest so sign-in stays unambiguous.
UPDATE users u
SET phone = ''
WHERE phone <> ''
  AND EXISTS (
    SELECT 1 FROM users v
    WHERE v.phone = u.phone
      AND (v.created_at, v.id) < (u.created_at, u.id)
  );

CREATE UNIQUE INDEX users_phone_key ON users (phone) WHERE phone <> '';

CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signin',
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

-- Down Migration
DROP TABLE IF EXISTS otp_codes;
DROP INDEX IF EXISTS users_phone_key;
UPDATE users SET email = phone || '@phone.ecocycle.ng' WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users DROP COLUMN IF EXISTS phone_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS role;
