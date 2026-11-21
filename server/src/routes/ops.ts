import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth.js';
import { findUserById, pool } from '../db.js';
import { canAgentMove, targetStatus, type AgentAction } from '../lifecycle.js';
import { notifyCustomer } from '../notify.js';

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
      const agent = await findUserById(request.body.agentId ?? '');
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
      const action = request.body.action as AgentAction;
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
          confirmed = Number(request.body.weight ?? 0);
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
          await client.query(
            `UPDATE users SET pending = pending + $1, month_kg = GREATEST(0, month_kg + $2),
             total_recycled = total_recycled + $3 WHERE id = $4`,
            [earning, Math.round(confirmed! - Number(pickup.weight)), Math.round(confirmed!), pickup.customer_id],
          );
          await client.query(
            `INSERT INTO payments (id, user_id, company, date_label, weight, amount, status)
             VALUES ($1, $2, 'GreenCycle Ltd', 'Pending', $3, $4, 'Pending')`,
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
              body: `${confirmed} kg confirmed. ₦${(earning ?? 0).toLocaleString('en-NG')} will be paid within 24 hours.`,
              sms: `EcoCycle: pickup complete, ${confirmed} kg confirmed. Payment of N${(earning ?? 0).toLocaleString('en-NG')} is pending.`,
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
}
