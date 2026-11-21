import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { pool, snapshotFor, findUserById } from '../db.js';
import { requireAuth } from '../auth.js';
import { CANCELLABLE_STATUSES } from '../lifecycle.js';
import { notifyCustomer } from '../notify.js';

interface PickupBody {
  category?: string;
  weight?: number;
  dateLabel?: string;
  time?: string;
  address?: string;
  area?: string;
}

interface PatchBody {
  action?: 'cancel' | 'reschedule';
  dateLabel?: string;
  time?: string;
}

const DEFAULT_AREA = 'lagos-mainland';

async function rateFor(area: string, category: string): Promise<number | null> {
  const { rows } = await pool.query<{ rate: number }>(
    `SELECT r.rate FROM service_area_rates r
     JOIN service_areas sa ON sa.key = r.area_key AND sa.active
     WHERE r.area_key = $1 AND r.category = $2`,
    [area, category],
  );
  return rows[0] ? Number(rows[0].rate) : null;
}

async function cancelPickup(reply: FastifyReply, collectionId: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query<{
      status: string;
      category: string;
      date_label: string;
      time: string;
      phone: string;
    }>(
      `SELECT c.status, c.category, c.date_label, c.time, u.phone
       FROM collections c JOIN users u ON u.id = c.user_id
       WHERE c.id = $1 AND c.user_id = $2 FOR UPDATE OF c`,
      [collectionId, userId],
    );
    if (found.rowCount === 0) {
      await client.query('ROLLBACK');
      return reply.code(404).send({ error: 'Pickup not found.' });
    }

    const pickup = found.rows[0];
    if (!(CANCELLABLE_STATUSES as string[]).includes(pickup.status)) {
      await client.query('ROLLBACK');
      return reply.code(409).send({ error: 'This pickup can no longer be cancelled.' });
    }

    await client.query(
      `UPDATE collections SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
      [collectionId],
    );
    await client.query(
      `INSERT INTO pickup_events (collection_id, from_status, to_status, actor_id, actor_role, note)
       VALUES ($1, $2, 'cancelled', $3, 'customer', 'Cancelled by the customer')`,
      [collectionId, pickup.status, userId],
    );
    await notifyCustomer(client, {
      userId,
      phone: pickup.phone,
      title: 'Pickup cancelled',
      body: `Your ${pickup.category} pickup on ${pickup.date_label} at ${pickup.time} has been cancelled.`,
      sms: `EcoCycle: your ${pickup.category} pickup on ${pickup.date_label} at ${pickup.time} is cancelled.`,
    });
    await client.query('COMMIT');
    return reply.send({ state: await snapshotFor(userId) });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default async function collectionRoutes(app: FastifyInstance) {
  app.get('/api/collections', { preHandler: requireAuth }, async (request, reply) => {
    const state = await snapshotFor(request.userId!);
    return reply.send({ collections: state?.collections ?? [] });
  });

  app.post<{ Body: PickupBody }>('/api/collections', { preHandler: requireAuth }, async (request, reply) => {
    const { category, dateLabel, time, address } = request.body;
    const weight = Number(request.body.weight ?? 0);
    const area = (request.body.area ?? DEFAULT_AREA).trim();

    if (!category) return reply.code(400).send({ error: 'Choose a waste category.' });
    if (!(weight > 0) || weight > 500) {
      return reply.code(400).send({ error: 'Enter a weight between 0 and 500 kg.' });
    }
    if (!time) return reply.code(400).send({ error: 'Choose a time slot.' });
    if (!dateLabel) return reply.code(400).send({ error: 'Choose a collection date.' });

    const cat = await pool.query('SELECT rate FROM categories WHERE key = $1', [category]);
    if (cat.rowCount === 0) return reply.code(400).send({ error: 'Unknown waste category.' });

    const rate = await rateFor(area, category);
    if (rate === null) {
      return reply.code(400).send({ error: 'We do not collect that category in this service area yet.' });
    }

    const user = await findUserById(request.userId!);
    if (!user) return reply.code(401).send({ error: 'Account not found.' });

    const userId = user.id;
    const earning = Math.round(weight * rate);
    const id = randomUUID();
    const pickupId = `#PC-${id.slice(0, 6).toUpperCase()}`;
    const company = 'GreenCycle Ltd';
    const place = address ?? '12 Okota Road, Lagos';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insert = await client.query(
        `INSERT INTO collections (id, user_id, category, company, date_label, time, weight, address, status, earning, pickup_id, area, rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'upcoming', $9, $10, $11, $12)
         RETURNING id`,
        [id, userId, category, company, dateLabel, time, weight, place, earning, pickupId, area, rate],
      );
      if (insert.rowCount === 0) throw new Error('insert failed');
      await client.query('UPDATE users SET month_kg = month_kg + $1 WHERE id = $2', [Math.round(weight), userId]);
      await client.query(
        `INSERT INTO pickup_events (collection_id, from_status, to_status, actor_id, actor_role, note)
         VALUES ($1, NULL, 'upcoming', $2, 'customer', 'Pickup requested')`,
        [id, userId],
      );
      await notifyCustomer(client, {
        userId,
        phone: user.phone,
        title: 'Pickup confirmed!',
        body: `${company} arrives ${dateLabel.toLowerCase()} at ${time}. Estimated ₦${earning.toLocaleString('en-NG')} at ${rate}/kg.`,
        sms: `EcoCycle: ${category} pickup booked for ${dateLabel} at ${time}. Your agent will be assigned shortly.`,
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const state = await snapshotFor(userId);
    const collection = state?.collections.find((c) => (c as { id: string }).id === id);
    return reply.code(201).send({ collection, state });
  });

  app.patch<{ Params: { id: string }; Body: PatchBody }>(
    '/api/collections/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { action, dateLabel, time } = request.body;

      if (action === 'cancel') {
        return cancelPickup(reply, id, userId);
      }
      if (action !== 'reschedule') {
        return reply.code(400).send({ error: 'Unknown action.' });
      }
      if (!dateLabel || !time) return reply.code(400).send({ error: 'Choose a new date and time.' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<{ status: string; category: string; phone: string }>(
          `SELECT c.status, c.category, u.phone
           FROM collections c JOIN users u ON u.id = c.user_id
           WHERE c.id = $1 AND c.user_id = $2 FOR UPDATE OF c`,
          [id, userId],
        );
        if (found.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Pickup not found.' });
        }

        const pickup = found.rows[0];
        if (!(CANCELLABLE_STATUSES as string[]).includes(pickup.status)) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'Pickups already on the way cannot be rescheduled.' });
        }

        await client.query('UPDATE collections SET date_label = $1, time = $2 WHERE id = $3', [
          dateLabel,
          time,
          id,
        ]);
        await client.query(
          `INSERT INTO pickup_events (collection_id, from_status, to_status, actor_id, actor_role, note)
           VALUES ($1, $2, $2, $3, 'customer', $4)`,
          [id, pickup.status, userId, `Rescheduled to ${dateLabel} at ${time}`],
        );
        await notifyCustomer(client, {
          userId,
          phone: pickup.phone,
          title: 'Pickup rescheduled',
          body: `Your ${pickup.category} pickup moved to ${dateLabel} at ${time}.`,
          sms: `EcoCycle: your ${pickup.category} pickup moved to ${dateLabel} at ${time}.`,
        });
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      return reply.send({ state: await snapshotFor(userId) });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/collections/:id',
    { preHandler: requireAuth },
    async (request, reply) => cancelPickup(reply, request.params.id, request.userId!),
  );
}
