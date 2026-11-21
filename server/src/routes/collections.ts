import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { pool, snapshotFor } from '../db.js';
import { requireAuth } from '../auth.js';

interface PickupBody {
  category?: string;
  weight?: number;
  dateLabel?: string;
  time?: string;
  address?: string;
}

interface PatchBody {
  action?: 'cancel' | 'reschedule';
  dateLabel?: string;
  time?: string;
}

export default async function collectionRoutes(app: FastifyInstance) {
  app.get('/api/collections', { preHandler: requireAuth }, async (request, reply) => {
    const state = await snapshotFor(request.userId!);
    return reply.send({ collections: state?.collections ?? [] });
  });

  app.post<{ Body: PickupBody }>('/api/collections', { preHandler: requireAuth }, async (request, reply) => {
    const { category, dateLabel, time, address } = request.body;
    const weight = Number(request.body.weight ?? 0);

    if (!category) return reply.code(400).send({ error: 'Choose a waste category.' });
    if (!(weight > 0) || weight > 500) {
      return reply.code(400).send({ error: 'Enter a weight between 0 and 500 kg.' });
    }
    if (!time) return reply.code(400).send({ error: 'Choose a time slot.' });
    if (!dateLabel) return reply.code(400).send({ error: 'Choose a collection date.' });

    const cat = await pool.query('SELECT rate FROM categories WHERE key = $1', [category]);
    if (cat.rowCount === 0) return reply.code(400).send({ error: 'Unknown waste category.' });

    const userId = request.userId!;
    const rate = cat.rows[0].rate as number;
    const earning = Math.round(weight * rate);
    const id = randomUUID();
    const pickupId = `#PC-${id.slice(0, 6).toUpperCase()}`;
    const company = 'GreenCycle Ltd';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insert = await client.query(
        `INSERT INTO collections (id, user_id, category, company, date_label, time, weight, address, status, earning, pickup_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'upcoming', $9, $10)
         RETURNING id`,
        [id, userId, category, company, dateLabel, time, weight, address ?? '12 Okota Road, Lagos', earning, pickupId],
      );
      if (insert.rowCount === 0) throw new Error('insert failed');
      await client.query('UPDATE users SET month_kg = month_kg + $1 WHERE id = $2', [Math.round(weight), userId]);
      await client.query(
        `INSERT INTO notifications (id, user_id, kind, title, body, time_label)
         VALUES ($1, $2, 'pickup', 'Pickup confirmed!', $3, 'Just now')`,
        [`n-${randomUUID()}`, userId, `${company} arrives ${dateLabel.toLowerCase()} at ${time}.`],
      );
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

      const found = await pool.query(
        'SELECT category, date_label, time FROM collections WHERE id = $1 AND user_id = $2',
        [id, userId],
      );
      if (found.rowCount === 0) return reply.code(404).send({ error: 'Pickup not found.' });

      if (action === 'cancel') {
        await pool.query('DELETE FROM collections WHERE id = $1 AND user_id = $2', [id, userId]);
      } else if (action === 'reschedule') {
        if (!dateLabel || !time) return reply.code(400).send({ error: 'Choose a new date and time.' });
        await pool.query(
          `UPDATE collections SET date_label = $1, time = $2, status = 'upcoming' WHERE id = $3 AND user_id = $4`,
          [dateLabel, time, id, userId],
        );
        const catName = found.rows[0].category as string;
        await pool.query(
          `INSERT INTO notifications (id, user_id, kind, title, body, time_label)
           VALUES ($1, $2, 'pickup', 'Pickup rescheduled', $3, 'Just now')`,
          [`n-${randomUUID()}`, userId, `Your ${catName} pickup moved to ${dateLabel} at ${time}.`],
        );
      } else {
        return reply.code(400).send({ error: 'Unknown action.' });
      }

      return reply.send({ state: await snapshotFor(userId) });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/collections/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.userId!;
      await pool.query('DELETE FROM collections WHERE id = $1 AND user_id = $2', [request.params.id, userId]);
      return reply.send({ state: await snapshotFor(userId) });
    },
  );
}
