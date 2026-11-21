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

// Tokens are reused so the auth rate limit is not tripped by repeated sign-ins.
const tokenCache = new Map<string, { response: Awaited<ReturnType<typeof app.inject>>; body: Record<string, unknown> }>();

async function signIn(email: string, password: string) {
  const key = `${email}:${password}`;
  const cached = tokenCache.get(key);
  if (cached) return cached;
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signin',
    payload: { email, password },
  });
  const result = { response, body: json(response) };
  if (response.statusCode === 200) tokenCache.set(key, result);
  return result;
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
  const state = ok.body.state as { balance: number; user: { role: string } };
  assert.equal(state.balance, 48200);
  assert.equal(state.user.role, 'customer');
});

test('sign-up creates an empty account and rejects duplicates', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { name: 'Test Recycler', email: 'test@ecocycle.ng', phone: '0803 555 0193', password: 'secret123' },
  });
  assert.equal(created.statusCode, 200);
  const state = json(created).state as {
    balance: number;
    user: { email: string; phone: string; role: string };
    collections: unknown[];
  };
  assert.equal(state.balance, 0);
  assert.equal(state.user.email, 'test@ecocycle.ng');
  assert.equal(state.user.phone, '+2348035550193');
  assert.equal(state.user.role, 'customer');
  assert.equal(state.collections.length, 0);

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { name: 'Test Recycler', email: 'test@ecocycle.ng', phone: '0803 555 0193', password: 'secret123' },
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

async function requestCode(phone: string): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  assert.equal(response.statusCode, 200);
  const code = json(response).devCode;
  assert.match(String(code), /^\d{6}$/);
  return String(code);
}

test('phone OTP signs in a known number and codes are single-use', async () => {
  const phone = '+234 803 555 0192';
  const code = await requestCode(phone);

  const verified = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code } });
  assert.equal(verified.statusCode, 200);
  const body = json(verified) as { token: string; state: { balance: number; user: { phone: string } } };
  assert.equal(typeof body.token, 'string');
  assert.equal(body.state.balance, 43200);
  assert.equal(body.state.user.phone, '+2348035550192');

  const reused = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code } });
  assert.equal(reused.statusCode, 400);
});

test('phone OTP creates a customer when the number is new', async () => {
  const phone = '0803 555 0100';
  const code = await requestCode(phone);

  const needsName = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code } });
  assert.equal(needsName.statusCode, 400);
  assert.equal((json(needsName) as { needsName?: boolean }).needsName, true);

  const created = await app.inject({
    method: 'POST',
    url: '/api/auth/otp/verify',
    payload: { phone, code, name: 'Ngozi Eze' },
  });
  assert.equal(created.statusCode, 200);
  const state = json(created).state as {
    balance: number;
    user: { name: string; phone: string; email: string; role: string };
  };
  assert.equal(state.balance, 0);
  assert.equal(state.user.name, 'Ngozi Eze');
  assert.equal(state.user.phone, '+2348035550100');
  assert.equal(state.user.email, '');
  assert.equal(state.user.role, 'customer');
});

test('phone OTP locks out after repeated wrong codes', async () => {
  const phone = '0803 555 0101';
  const code = await requestCode(phone);
  const wrong = code === '000000' ? '111111' : '000000';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: wrong } });
    assert.equal(response.statusCode, 400);
  }

  const locked = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code } });
  assert.equal(locked.statusCode, 429);
});

test('service areas price pickups by area', async () => {
  const areas = await app.inject({ method: 'GET', url: '/api/service-areas' });
  assert.equal(areas.statusCode, 200);
  const list = json(areas).areas as Array<{ key: string; rates: Record<string, number> }>;
  const mainland = list.find((a) => a.key === 'lagos-mainland');
  const island = list.find((a) => a.key === 'lagos-island');
  assert.equal(mainland?.rates.plastic, 80);
  assert.equal(island?.rates.plastic, 90);

  const { body } = await signIn('test@ecocycle.ng', 'secret123');
  const booked = await app.inject({
    method: 'POST',
    url: '/api/collections',
    headers: { authorization: `Bearer ${body.token}` },
    payload: {
      category: 'plastic',
      weight: 4,
      dateLabel: 'Today',
      time: '12:00 PM',
      address: '18 Admiralty Way, Lekki',
      area: 'lagos-island',
    },
  });
  assert.equal(booked.statusCode, 201);
  const collection = (json(booked) as { collection: { earning: number; rate: number; area: string } }).collection;
  assert.equal(collection.rate, 90);
  assert.equal(collection.earning, 360);
  assert.equal(collection.area, 'lagos-island');

  const unknown = await app.inject({
    method: 'POST',
    url: '/api/collections',
    headers: { authorization: `Bearer ${body.token}` },
    payload: { category: 'plastic', weight: 1, dateLabel: 'Today', time: '12:00 PM', area: 'mars' },
  });
  assert.equal(unknown.statusCode, 400);
});

test('only the assigned agent can progress a pickup, and the agent confirms the weight', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const otherAgent = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, phone, password_hash, role)
     VALUES ('Nia Bello', 'nia@ecocycle.ng', '+2348030000009', $1, 'agent') RETURNING id`,
    [await bcrypt.hash('secret123', 4)],
  );
  assert.ok(otherAgent.rows[0].id);

  const customer = await signIn('test@ecocycle.ng', 'secret123');
  const booked = await app.inject({
    method: 'POST',
    url: '/api/collections',
    headers: { authorization: `Bearer ${customer.body.token}` },
    payload: {
      category: 'metal',
      weight: 3,
      dateLabel: 'Tomorrow',
      time: '10:00 AM',
      address: '12 Okota Road, Lagos',
      area: 'lagos-mainland',
    },
  });
  assert.equal(booked.statusCode, 201);
  const pickupId = (json(booked) as { collection: { id: string } }).collection.id;

  const admin = await signIn('admin@ecocycle.ng', 'demo1234');
  const agents = await app.inject({
    method: 'GET',
    url: '/api/ops/agents',
    headers: { authorization: `Bearer ${admin.body.token}` },
  });
  const grace = (json(agents).agents as Array<{ id: string; name: string }>).find(
    (a) => a.name === 'Grace Adeyemi',
  );
  assert.ok(grace);

  const assigned = await app.inject({
    method: 'POST',
    url: `/api/ops/pickups/${pickupId}/assign`,
    headers: { authorization: `Bearer ${admin.body.token}` },
    payload: { agentId: grace!.id },
  });
  assert.equal(assigned.statusCode, 200);
  const assignedPickup = (json(assigned) as { pickup: { status: string; agent: { name: string } } }).pickup;
  assert.equal(assignedPickup.status, 'assigned');
  assert.equal(assignedPickup.agent.name, 'Grace Adeyemi');

  const reassigned = await app.inject({
    method: 'POST',
    url: `/api/ops/pickups/${pickupId}/assign`,
    headers: { authorization: `Bearer ${admin.body.token}` },
    payload: { agentId: grace!.id },
  });
  assert.equal(reassigned.statusCode, 409);

  const nia = await signIn('nia@ecocycle.ng', 'secret123');
  const forbidden = await app.inject({
    method: 'POST',
    url: `/api/ops/pickups/${pickupId}/transition`,
    headers: { authorization: `Bearer ${nia.body.token}` },
    payload: { action: 'en_route' },
  });
  assert.equal(forbidden.statusCode, 403);

  const graceSignIn = await signIn('agent@ecocycle.ng', 'demo1234');
  const skip = await app.inject({
    method: 'POST',
    url: `/api/ops/pickups/${pickupId}/transition`,
    headers: { authorization: `Bearer ${graceSignIn.body.token}` },
    payload: { action: 'complete', weight: 3 },
  });
  assert.equal(skip.statusCode, 409);

  const enRoute = await app.inject({
    method: 'POST',
    url: `/api/ops/pickups/${pickupId}/transition`,
    headers: { authorization: `Bearer ${graceSignIn.body.token}` },
    payload: { action: 'en_route' },
  });
  assert.equal(enRoute.statusCode, 200);
  assert.equal((json(enRoute) as { pickup: { status: string } }).pickup.status, 'en_route');

  const cancelLate = await app.inject({
    method: 'DELETE',
    url: `/api/collections/${pickupId}`,
    headers: { authorization: `Bearer ${customer.body.token}` },
  });
  assert.equal(cancelLate.statusCode, 409);

  const arrived = await app.inject({
    method: 'POST',
    url: `/api/ops/pickups/${pickupId}/transition`,
    headers: { authorization: `Bearer ${graceSignIn.body.token}` },
    payload: { action: 'arrived' },
  });
  assert.equal(arrived.statusCode, 200);

  const badWeight = await app.inject({
    method: 'POST',
    url: `/api/ops/pickups/${pickupId}/transition`,
    headers: { authorization: `Bearer ${graceSignIn.body.token}` },
    payload: { action: 'complete', weight: 0 },
  });
  assert.equal(badWeight.statusCode, 400);

  const completed = await app.inject({
    method: 'POST',
    url: `/api/ops/pickups/${pickupId}/transition`,
    headers: { authorization: `Bearer ${graceSignIn.body.token}` },
    payload: { action: 'complete', weight: 2.7 },
  });
  assert.equal(completed.statusCode, 200);
  const done = (json(completed) as {
    pickup: { status: string; confirmedWeight: number; earning: number };
  }).pickup;
  assert.equal(done.status, 'completed');
  assert.equal(done.confirmedWeight, 2.7);
  assert.equal(done.earning, 324);

  const me = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { authorization: `Bearer ${customer.body.token}` },
  });
  const state = json(me).state as {
    pending: number;
    collections: Array<{ id: string; status: string }>;
    payments: Array<{ amount: number; status: string }>;
  };
  assert.equal(state.pending, 324);
  assert.equal(state.collections.find((c) => c.id === pickupId)?.status, 'completed');
  assert.equal(state.payments[0].amount, 324);
  assert.equal(state.payments[0].status, 'Pending');
});

test('customer cancellation is a soft cancel and closes the pickup', async () => {
  const customer = await signIn('test@ecocycle.ng', 'secret123');
  const booked = await app.inject({
    method: 'POST',
    url: '/api/collections',
    headers: { authorization: `Bearer ${customer.body.token}` },
    payload: { category: 'paper', weight: 2, dateLabel: 'Today', time: '4:00 PM', area: 'lagos-mainland' },
  });
  const pickupId = (json(booked) as { collection: { id: string } }).collection.id;

  const cancelled = await app.inject({
    method: 'DELETE',
    url: `/api/collections/${pickupId}`,
    headers: { authorization: `Bearer ${customer.body.token}` },
  });
  assert.equal(cancelled.statusCode, 200);
  const state = json(cancelled).state as { collections: Array<{ id: string; status: string }> };
  assert.equal(state.collections.find((c) => c.id === pickupId)?.status, 'cancelled');

  const again = await app.inject({
    method: 'DELETE',
    url: `/api/collections/${pickupId}`,
    headers: { authorization: `Bearer ${customer.body.token}` },
  });
  assert.equal(again.statusCode, 409);
});

test('the ops user list is restricted to admins', async () => {
  const admin = await signIn('admin@ecocycle.ng', 'demo1234');
  const listed = await app.inject({
    method: 'GET',
    url: '/api/ops/users',
    headers: { authorization: `Bearer ${admin.body.token}` },
  });
  assert.equal(listed.statusCode, 200);
  const users = json(listed).users as Array<{ role: string }>;
  assert.ok(users.some((u) => u.role === 'admin'));

  const customer = await signIn('amaka@gmail.com', 'demo1234');
  const denied = await app.inject({
    method: 'GET',
    url: '/api/ops/users',
    headers: { authorization: `Bearer ${customer.body.token}` },
  });
  assert.equal(denied.statusCode, 403);

  const anonymous = await app.inject({ method: 'GET', url: '/api/ops/users' });
  assert.equal(anonymous.statusCode, 401);
});
