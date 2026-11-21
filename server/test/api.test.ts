import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const ADMIN_URL = process.env.TEST_ADMIN_URL ?? 'postgres://ecocycle:ecocycle@localhost:5436/postgres';
const TEST_DB = 'ecocycle_test';
const TEST_URL = process.env.TEST_DATABASE_URL ?? `postgres://ecocycle:ecocycle@localhost:5436/${TEST_DB}`;

const admin = new pg.Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${TEST_DB}`);
await admin.end();

process.env.DATABASE_URL = TEST_URL;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';

const { runMigrations } = await import('../src/migrate.js');
const { buildApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { seedDemoData } = await import('../src/seed.js');

await runMigrations(TEST_URL);
await seedDemoData();
const app = await buildApp();

after(async () => {
  await app.close();
  await pool.end();
});

const json = (response: { body: string }) => JSON.parse(response.body) as Record<string, unknown>;

async function signIn(email: string, password: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signin',
    payload: { email, password },
  });
  return { response, body: json(response) };
}

test('health and liveness report the database state', async () => {
  const live = await app.inject({ method: 'GET', url: '/api/live' });
  assert.equal(live.statusCode, 200);

  const health = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(json(health), { ok: true, db: true });
});

test('sign-in rejects a wrong password and accepts the seeded account', async () => {
  const wrong = await signIn('amaka@gmail.com', 'wrongpass');
  assert.equal(wrong.response.statusCode, 401);

  const ok = await signIn('amaka@gmail.com', 'demo1234');
  assert.equal(ok.response.statusCode, 200);
  assert.equal(typeof ok.body.token, 'string');
  assert.equal((ok.body.state as { balance: number }).balance, 48200);
});

test('sign-up creates an empty account and rejects duplicates', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { name: 'Test Recycler', email: 'test@ecocycle.ng', phone: '08035550192', password: 'secret123' },
  });
  assert.equal(created.statusCode, 200);
  const state = json(created).state as { balance: number; user: { email: string }; collections: unknown[] };
  assert.equal(state.balance, 0);
  assert.equal(state.user.email, 'test@ecocycle.ng');
  assert.equal(state.collections.length, 0);

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { name: 'Test Recycler', email: 'test@ecocycle.ng', phone: '08035550192', password: 'secret123' },
  });
  assert.equal(duplicate.statusCode, 409);
});

test('protected routes require a token', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/collections' });
  assert.equal(response.statusCode, 401);
});

test('a pickup is stored with the computed earning', async () => {
  const { body } = await signIn('test@ecocycle.ng', 'secret123');
  const token = body.token as string;

  const created = await app.inject({
    method: 'POST',
    url: '/api/collections',
    headers: { authorization: `Bearer ${token}` },
    payload: { category: 'plastic', weight: 5, dateLabel: 'Today', time: '10:00 AM', address: '12 Okota Road, Lagos' },
  });
  assert.equal(created.statusCode, 201);
  const payload = json(created) as {
    collection: { id: string; earning: number; pickupId: string };
    state: { monthKg: number; collections: unknown[] };
  };
  assert.equal(payload.collection.earning, 400);
  assert.match(payload.collection.pickupId, /^#PC-[0-9A-F]{6}$/);
  assert.equal(payload.state.monthKg, 5);
  assert.equal(payload.state.collections.length, 1);

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/collections',
    headers: { authorization: `Bearer ${token}` },
    payload: { category: 'plastic', weight: 0, dateLabel: 'Today', time: '10:00 AM', address: '12 Okota Road, Lagos' },
  });
  assert.equal(invalid.statusCode, 400);
});

test('withdrawals debit the balance and cannot overdraw', async () => {
  const { body } = await signIn('amaka@gmail.com', 'demo1234');
  const token = body.token as string;

  const tooMuch = await app.inject({
    method: 'POST',
    url: '/api/wallet/withdraw',
    headers: { authorization: `Bearer ${token}` },
    payload: { amount: 999999 },
  });
  assert.equal(tooMuch.statusCode, 400);

  const valid = await app.inject({
    method: 'POST',
    url: '/api/wallet/withdraw',
    headers: { authorization: `Bearer ${token}` },
    payload: { amount: 5000 },
  });
  assert.equal(valid.statusCode, 200);
  const state = json(valid).state as { balance: number; payments: Array<{ amount: number }> };
  assert.equal(state.balance, 43200);
  assert.equal(state.payments[0].amount, 5000);
});

test('demo reset clears activity for the signed-in account', async () => {
  const { body } = await signIn('test@ecocycle.ng', 'secret123');
  const token = body.token as string;

  const reset = await app.inject({
    method: 'POST',
    url: '/api/demo/reset',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload: {},
  });
  assert.equal(reset.statusCode, 200);
  const state = json(reset).state as { collections: unknown[]; monthKg: number; balance: number };
  assert.equal(state.collections.length, 0);
  assert.equal(state.monthKg, 0);
  assert.equal(state.balance, 0);
});
