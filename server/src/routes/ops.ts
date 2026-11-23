import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { requireRole } from '../auth.js';
import { findUserById, pool } from '../db.js';
import { platformAccount, postLedger, userAccounts, walletBalances } from '../ledger.js';
import { canAgentMove, targetStatus, type AgentAction } from '../lifecycle.js';
import { notifyCustomer } from '../notify.js';
import { payoutsConfigured } from '../payments.js';
import { settlePayout, startPayoutTransfer, type PayoutRow } from '../payouts.js';

interface PickupRow {
  id: string;
  pickup_id: string | null;
  status: string;
  category: string;
  weight: string;
  confirmed_weight: string | null;
  rate: number | null;
  date_label: string;
  time: string;
  address: string;
  area: string | null;
  area_name: string | null;
  earning: number | null;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_phone: string | null;
}

const PICKUP_SELECT = `
  SELECT c.id, c.pickup_id, c.status, c.category, c.weight, c.confirmed_weight, c.rate,
         c.date_label, c.time, c.address, c.area, c.earning,
         sa.name AS area_name,
         u.id AS customer_id, u.name AS customer_name, u.phone AS customer_phone,
         ag.id AS agent_id, ag.name AS agent_name, ag.phone AS agent_phone
  FROM collections c
  JOIN users u ON u.id = c.user_id
  LEFT JOIN service_areas sa ON sa.key = c.area
  LEFT JOIN users ag ON ag.id = c.agent_id`;

function pickupView(row: PickupRow) {
  return {
    id: row.id,
    pickupId: row.pickup_id,
    status: row.status,
    category: row.category,
    weight: Number(row.weight),
    confirmedWeight: row.confirmed_weight === null ? null : Number(row.confirmed_weight),
    rate: row.rate === null ? null : Number(row.rate),
    dateLabel: row.date_label,
    time: row.time,
    address: row.address,
    area: row.area,
    areaName: row.area_name,
    earning: row.earning,
    customer: { name: row.customer_name, phone: row.customer_phone },
    agent: row.agent_id ? { id: row.agent_id, name: row.agent_name, phone: row.agent_phone } : null,
  };
}

const ACTIONS: AgentAction[] = ['en_route', 'arrived', 'complete', 'release'];

export default async function opsRoutes(app: FastifyInstance) {
  app.get('/api/ops/users', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      email: string | null;
      phone: string;
      role: string;
      created_at: string;
    }>('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC LIMIT 50');
    return {
      users: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email ?? '',
        phone: r.phone,
        role: r.role,
        createdAt: r.created_at,
      })),
    };
  });

  app.get('/api/ops/agents', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await pool.query<{ id: string; name: string; phone: string }>(
      `SELECT id, name, phone FROM users WHERE role = 'agent' ORDER BY name`,
    );
    return { agents: rows };
  });

  app.get('/api/ops/pickups', { preHandler: requireRole('agent', 'admin') }, async (request) => {
    const actor = await findUserById(request.userId!);
    const { rows } =
      actor?.role === 'agent'
        ? await pool.query<PickupRow>(`${PICKUP_SELECT} WHERE c.agent_id = $1 ORDER BY c.created_at DESC LIMIT 100`, [
            actor.id,
          ])
        : await pool.query<PickupRow>(`${PICKUP_SELECT} ORDER BY c.created_at DESC LIMIT 100`);
    return { pickups: rows.map(pickupView) };
  });

  app.post<{ Params: { id: string }; Body: { agentId?: string } }>(
    '/api/ops/pickups/:id/assign',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const agent = await findUserById(request.body?.agentId ?? '');
      if (!agent || agent.role !== 'agent') {
        return reply.code(400).send({ error: 'Choose a field agent to assign.' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<{ status: string; user_id: string; category: string }>(
          'SELECT status, user_id, category FROM collections WHERE id = $1 FOR UPDATE',
          [request.params.id],
        );
        if (found.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Pickup not found.' });
        }
        if (found.rows[0].status !== 'upcoming') {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'Only pickups awaiting an agent can be assigned.' });
        }

        await client.query(
          `UPDATE collections SET status = 'assigned', agent_id = $1 WHERE id = $2`,
          [agent.id, request.params.id],
        );
        const customer = await client.query<{ phone: string }>('SELECT phone FROM users WHERE id = $1', [
          found.rows[0].user_id,
        ]);
        await client.query(
          `INSERT INTO pickup_events (collection_id, from_status, to_status, actor_id, actor_role, note)
           VALUES ($1, 'upcoming', 'assigned', $2, 'admin', $3)`,
          [request.params.id, request.userId!, `Assigned to ${agent.name}`],
        );
        await notifyCustomer(client, {
          userId: found.rows[0].user_id,
          phone: customer.rows[0].phone,
          title: 'Agent assigned',
          body: `${agent.name} will handle your ${found.rows[0].category} pickup.`,
          sms: `EcoCycle: ${agent.name} is assigned to your ${found.rows[0].category} pickup. ${agent.phone}`,
        });

        const pickup = await client.query<PickupRow>(`${PICKUP_SELECT} WHERE c.id = $1`, [request.params.id]);
        await client.query('COMMIT');
        return reply.send({ pickup: pickupView(pickup.rows[0]) });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { action?: string; weight?: number } }>(
    '/api/ops/pickups/:id/transition',
    { preHandler: requireRole('agent', 'admin') },
    async (request, reply) => {
      const body = request.body ?? {};
      const action = body.action as AgentAction;
      if (!ACTIONS.includes(action)) {
        return reply.code(400).send({ error: 'Unknown lifecycle action.' });
      }

      const actor = await findUserById(request.userId!);
      if (!actor) return reply.code(401).send({ error: 'Account not found.' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<PickupRow>(`${PICKUP_SELECT} WHERE c.id = $1 FOR UPDATE OF c`, [
          request.params.id,
        ]);
        if (found.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Pickup not found.' });
        }

        const pickup = found.rows[0];
        if (actor.role === 'agent' && pickup.agent_id !== actor.id) {
          await client.query('ROLLBACK');
          return reply.code(403).send({ error: 'This pickup is assigned to another agent.' });
        }
        if (!canAgentMove(pickup.status, action)) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: `A pickup that is ${pickup.status} cannot be moved to that stage.` });
        }

        const next = targetStatus(action);
        let note: string | null = null;
        let earning: number | null = pickup.earning;
        let confirmed: number | null = null;

        if (action === 'complete') {
          confirmed = Number(body.weight ?? 0);
          if (!(confirmed > 0) || confirmed > 500) {
            await client.query('ROLLBACK');
            return reply.code(400).send({ error: 'Enter the confirmed weight between 0 and 500 kg.' });
          }
          let rate = pickup.rate;
          if (rate === null && pickup.area) {
            const areaRate = await client.query<{ rate: number }>(
              'SELECT rate FROM service_area_rates WHERE area_key = $1 AND category = $2',
              [pickup.area, pickup.category],
            );
            rate = areaRate.rows[0] ? Number(areaRate.rows[0].rate) : null;
          }
          if (rate === null) {
            const base = await client.query<{ rate: number }>('SELECT rate FROM categories WHERE key = $1', [
              pickup.category,
            ]);
            rate = base.rows[0] ? Number(base.rows[0].rate) : 0;
          }
          earning = Math.round(confirmed * rate);
          note = `Confirmed ${confirmed} kg at ${rate}/kg`;
        }

        if (action === 'release') {
          await client.query(
            `UPDATE collections SET status = 'upcoming', agent_id = NULL WHERE id = $1`,
            [pickup.id],
          );
        } else if (action === 'complete') {
          await client.query(
            `UPDATE collections SET status = 'completed', confirmed_weight = $1, earning = $2 WHERE id = $3`,
            [confirmed, earning, pickup.id],
          );
          const accounts = await userAccounts(client, pickup.customer_id);
          const funder = await platformAccount(client, 'platform_earnings');
          await postLedger(
            client,
            { type: 'pickup_earning', id: pickup.id, memo: `Earning for pickup ${pickup.id}` },
            [
              { accountId: funder, direction: 'debit', amount: earning! },
              { accountId: accounts.pending, direction: 'credit', amount: earning! },
            ],
          );
          await client.query(
            `UPDATE users SET month_kg = month_kg + $1, total_recycled = total_recycled + $1,
               total_earned = total_earned + $2
             WHERE id = $3`,
            [Math.round(confirmed!), earning!, pickup.customer_id],
          );
          await client.query(
            `INSERT INTO payments (id, user_id, company, date_label, weight, amount, status)
             VALUES ($1, $2, 'GreenCycle Ltd', 'Today', $3, $4, 'Pending')`,
            [`pay-${pickup.id}-${Date.now()}`, pickup.customer_id, confirmed, earning],
          );
        } else {
          await client.query('UPDATE collections SET status = $1 WHERE id = $2', [next, pickup.id]);
        }

        await client.query(
          `INSERT INTO pickup_events (collection_id, from_status, to_status, actor_id, actor_role, note)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [pickup.id, pickup.status, next, actor.id, actor.role, note],
        );

        if (action !== 'release') {
          const messages: Record<Exclude<AgentAction, 'release'>, { title: string; body: string; sms: string }> = {
            en_route: {
              title: 'Agent on the way',
              body: `Your agent is travelling to ${pickup.address}.`,
              sms: 'EcoCycle: your agent is on the way to your pickup address.',
            },
            arrived: {
              title: 'Agent has arrived',
              body: 'Your agent is at the pickup address and will confirm the weight.',
              sms: 'EcoCycle: your agent has arrived for the pickup.',
            },
            complete: {
              title: 'Pickup complete',
              body: `${confirmed} kg confirmed. ₦${(earning ?? 0).toLocaleString('en-NG')} is pending and will move to your balance once the batch is verified.`,
              sms: `EcoCycle: pickup complete, ${confirmed} kg confirmed. N${(earning ?? 0).toLocaleString('en-NG')} is pending release.`,
            },
          };
          const message = messages[action];
          await notifyCustomer(client, {
            userId: pickup.customer_id,
            phone: pickup.customer_phone,
            ...message,
          });
        }

        const updated = await client.query<PickupRow>(`${PICKUP_SELECT} WHERE c.id = $1`, [pickup.id]);
        await client.query('COMMIT');
        return reply.send({ pickup: pickupView(updated.rows[0]) });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );

  interface PayoutListRow {
    id: string;
    amount: string;
    status: string;
    provider: string;
    provider_ref: string | null;
    failure_reason: string | null;
    bank_name: string;
    bank_last4: string;
    created_at: string;
    user_id: string;
    name: string;
    phone: string;
  }

  const PAYOUT_SELECT = `
    SELECT po.id, po.amount, po.status, po.provider, po.provider_ref, po.failure_reason,
           po.bank_name, po.bank_last4, po.created_at, u.id AS user_id, u.name, u.phone
    FROM payouts po JOIN users u ON u.id = po.user_id`;

  function payoutView(row: PayoutListRow) {
    return {
      id: row.id,
      amount: Number(row.amount),
      status: row.status,
      provider: row.provider,
      providerRef: row.provider_ref,
      failureReason: row.failure_reason,
      bank: { name: row.bank_name, last4: row.bank_last4 },
      customer: { id: row.user_id, name: row.name, phone: row.phone },
      createdAt: row.created_at,
    };
  }

  async function loadPayout(id: string): Promise<PayoutListRow | null> {
    const { rows } = await pool.query<PayoutListRow>(`${PAYOUT_SELECT} WHERE po.id = $1`, [id]);
    return rows[0] ?? null;
  }

  app.get('/api/ops/payouts', { preHandler: requireRole('admin') }, async () => {
    const [payouts, pending] = await Promise.all([
      pool.query<PayoutListRow>(`${PAYOUT_SELECT} ORDER BY po.created_at DESC LIMIT 100`),
      pool.query<{ user_id: string; name: string; phone: string; amount: string }>(
        `SELECT u.id AS user_id, u.name, u.phone,
                SUM(CASE e.direction WHEN 'credit' THEN e.amount ELSE -e.amount END)::bigint AS amount
         FROM ledger_accounts a
         JOIN users u ON u.id = a.user_id
         LEFT JOIN ledger_entries e ON e.account_id = a.id
         WHERE a.kind = 'pending'
         GROUP BY u.id, u.name, u.phone
         HAVING SUM(CASE e.direction WHEN 'credit' THEN e.amount ELSE -e.amount END) > 0
         ORDER BY amount DESC`,
      ),
    ]);
    return {
      provider: config.paymentsProvider,
      payouts: payouts.rows.map(payoutView),
      pendingEarnings: pending.rows.map((row) => ({
        userId: row.user_id,
        name: row.name,
        phone: row.phone,
        amount: Number(row.amount),
      })),
    };
  });

  app.post<{ Params: { id: string }; Body: { outcome?: string; reason?: string } }>(
    '/api/ops/payouts/:id/confirm',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      if (config.paymentsProvider !== 'console') {
        return reply.code(409).send({ error: 'Payouts settle through the provider webhook.' });
      }
      const outcome = request.body?.outcome === 'failed' ? 'failed' : 'paid';
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<PayoutRow>('SELECT * FROM payouts WHERE id = $1 FOR UPDATE', [
          request.params.id,
        ]);
        if (found.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Payout not found.' });
        }
        const settled = await settlePayout(client, found.rows[0], outcome, request.body?.reason);
        if (!settled) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'Only an open payout can be confirmed.' });
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return reply.send({ payout: payoutView((await loadPayout(request.params.id))!) });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/ops/payouts/:id/retry',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      if (!payoutsConfigured()) {
        return reply.code(503).send({ error: 'Payouts are not configured on this server.' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<PayoutRow>('SELECT * FROM payouts WHERE id = $1 FOR UPDATE', [
          request.params.id,
        ]);
        if (found.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Payout not found.' });
        }
        const payout = found.rows[0];
        if (payout.status !== 'failed') {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'Only a failed payout can be retried.' });
        }

        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [payout.user_id]);
        const balances = await walletBalances(client, payout.user_id);
        if (Number(payout.amount) > balances.available) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'The customer no longer has enough balance to retry this payout.' });
        }

        const accounts = await userAccounts(client, payout.user_id);
        const payoutsAccount = await platformAccount(client, 'platform_payouts');
        const amount = Number(payout.amount);
        await postLedger(
          client,
          { type: 'payout_hold', id: payout.id, memo: `Retry ${payout.id}` },
          [
            { accountId: accounts.wallet, direction: 'debit', amount },
            { accountId: payoutsAccount, direction: 'credit', amount },
          ],
        );
        await client.query(
          `UPDATE payouts SET status = 'pending', failure_reason = NULL, provider_ref = NULL, updated_at = now()
           WHERE id = $1`,
          [payout.id],
        );
        await client.query('UPDATE payments SET status = $1 WHERE id = $2', ['Pending', `pay-${payout.id}`]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      const started = await startPayoutTransfer(request.params.id);
      if (!started.ok) {
        return reply.code(502).send({ error: `The payout provider rejected the retry: ${started.error}` });
      }
      return reply.send({ payout: payoutView((await loadPayout(request.params.id))!) });
    },
  );

  app.post<{ Params: { id: string }; Body: { amount?: number } }>(
    '/api/ops/customers/:id/settle',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const requested = Math.round(Number(request.body?.amount ?? 0));
      if (!Number.isFinite(requested) || requested < 0) {
        return reply.code(400).send({ error: 'Enter a valid amount to release.' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<{ id: string; name: string; phone: string }>(
          'SELECT id, name, phone FROM users WHERE id = $1 FOR UPDATE',
          [request.params.id],
        );
        if (found.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Customer not found.' });
        }
        const customer = found.rows[0];
        const balances = await walletBalances(client, customer.id);
        const amount = requested > 0 ? requested : balances.pending;
        if (amount <= 0) {
          await client.query('ROLLBACK');
          return reply.code(400).send({ error: 'No pending earnings to release.' });
        }
        if (amount > balances.pending) {
          await client.query('ROLLBACK');
          return reply
            .code(400)
            .send({ error: `Only ₦${balances.pending.toLocaleString('en-NG')} is pending for this customer.` });
        }

        const accounts = await userAccounts(client, customer.id);
        await postLedger(
          client,
          { type: 'settlement', id: customer.id, memo: `Released pending earnings for ${customer.name}` },
          [
            { accountId: accounts.pending, direction: 'debit', amount },
            { accountId: accounts.wallet, direction: 'credit', amount },
          ],
        );
        // Partial releases leave the remaining earnings pending, so the
        // payment rows only flip to Paid once the whole balance is cleared.
        if (amount === balances.pending) {
          await client.query(
            `UPDATE payments SET status = 'Paid'
             WHERE user_id = $1 AND status = 'Pending' AND company <> 'Bank withdrawal'`,
            [customer.id],
          );
        }
        await notifyCustomer(client, {
          userId: customer.id,
          phone: customer.phone,
          title: 'Earnings released',
          body: `₦${amount.toLocaleString('en-NG')} moved from pending to your available balance.`,
          sms: `EcoCycle: ₦${amount.toLocaleString('en-NG')} is now available to withdraw.`,
        });
        await client.query('COMMIT');
        return reply.send({ settled: amount, pending: balances.pending - amount });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );
}
