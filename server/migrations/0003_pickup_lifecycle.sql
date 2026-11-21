-- Up Migration
CREATE TABLE service_areas (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE service_area_rates (
  area_key TEXT NOT NULL REFERENCES service_areas(key) ON DELETE CASCADE,
  category TEXT NOT NULL REFERENCES categories(key),
  rate INTEGER NOT NULL CHECK (rate >= 0),
  PRIMARY KEY (area_key, category)
);

INSERT INTO service_areas (key, name, city) VALUES
  ('lagos-mainland', 'Okota & Surulere', 'Lagos'),
  ('lagos-island', 'Lekki & Victoria Island', 'Lagos'),
  ('abuja-central', 'Abuja Central', 'Abuja');

INSERT INTO service_area_rates (area_key, category, rate)
SELECT 'lagos-mainland', key, rate FROM categories;

INSERT INTO service_area_rates (area_key, category, rate)
SELECT 'lagos-island', key, (round(rate * 1.15 / 5) * 5)::int FROM categories;

INSERT INTO service_area_rates (area_key, category, rate)
SELECT 'abuja-central', key, (round(rate * 1.1 / 5) * 5)::int FROM categories;

ALTER TABLE collections ADD COLUMN area TEXT REFERENCES service_areas(key);
ALTER TABLE collections ADD COLUMN agent_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE collections ADD COLUMN confirmed_weight NUMERIC(8,2)
  CHECK (confirmed_weight IS NULL OR (confirmed_weight > 0 AND confirmed_weight <= 500));
ALTER TABLE collections ADD COLUMN rate INTEGER CHECK (rate IS NULL OR rate >= 0);
ALTER TABLE collections ADD COLUMN cancelled_at TIMESTAMPTZ;

UPDATE collections SET status = 'upcoming' WHERE status NOT IN ('upcoming', 'completed', 'cancelled');

ALTER TABLE collections ADD CONSTRAINT collections_status_check
  CHECK (status IN ('upcoming', 'assigned', 'en_route', 'arrived', 'completed', 'cancelled'));

CREATE INDEX collections_agent_idx ON collections(agent_id, status);

UPDATE collections SET rate = round(earning / weight)::int WHERE earning IS NOT NULL AND weight > 0;

UPDATE collections
SET area = CASE
  WHEN address ILIKE '%lekki%' OR address ILIKE '%victoria island%' OR address ILIKE '%ikoyi%'
    THEN 'lagos-island'
  WHEN address ILIKE '%abuja%' OR address ILIKE '%wuse%' OR address ILIKE '%garki%'
    THEN 'abuja-central'
  ELSE 'lagos-mainland'
END;

CREATE TABLE pickup_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'system',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pickup_events_collection_idx ON pickup_events(collection_id, created_at);

INSERT INTO pickup_events (collection_id, from_status, to_status, actor_role, note, created_at)
SELECT id, NULL, status, 'system', 'Imported history', created_at FROM collections;

-- Down Migration
DROP TABLE IF EXISTS pickup_events;
DROP INDEX IF EXISTS collections_agent_idx;
ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_status_check;
UPDATE collections SET status = 'upcoming' WHERE status IN ('assigned', 'en_route', 'arrived');
ALTER TABLE collections DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE collections DROP COLUMN IF EXISTS rate;
ALTER TABLE collections DROP COLUMN IF EXISTS confirmed_weight;
ALTER TABLE collections DROP COLUMN IF EXISTS agent_id;
ALTER TABLE collections DROP COLUMN IF EXISTS area;
DROP TABLE IF EXISTS service_area_rates;
DROP TABLE IF EXISTS service_areas;
