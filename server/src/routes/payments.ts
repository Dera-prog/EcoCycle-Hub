import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { pool } from '../db.js';
import { verifyPaystackSignature } from '../payments.js';
import { settlePayout, reversePayout, type PayoutRow } from '../payouts.js';

interface PaystackEvent {
  id?: unknown;
  event?: unknown;
  data?: { id?: unknown; reference?: unknown; gateway_response?: unknown };
}

const TRANSFER_EVENTS = new Set(['transfer.success', 'transfer.failed', 'transfer.reversed']);

export default async function paymentRoutes(app: FastifyInstance) {
  app.post('/api/webhooks/paystack', async (request, reply) => {
    if (config.paymentsProvider !== 'paystack' || !config.paystackSecret) {
      return reply.code(503).send({ error: 'Payout webhooks are not configured.' });
    }
    const raw = request.rawBody;
    const signature = request.headers['x-paystack-signature'];
    if (!raw || typeof signature !== 'string' || !verifyPaystackSignature(config.paystackSecret, raw, signature)) {
      return reply.code(401).send({ error: 'Invalid webhook signature.' });
    }

    let event: PaystackEvent;
    try {
      event = JSON.parse(raw.toString('utf8')) as PaystackEvent;
    } catch {
      return reply.code(400).send({ error: 'Malformed webhook payload.' });
    }

    const eventType = String(event.event ?? '');
    const reference = String(event.data?.reference ?? '');
    const eventId = String(event.id ?? event.data?.id ?? '');
    if (!TRANSFER_EVENTS.has(eventType) || !reference || !eventId) {
      return reply.send({ ok: true, ignored: true });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const seen = await client.query<{ id: string }>(
        `INSERT INTO payment_events (provider, event_id, event_type)
         VALUES ('paystack', $1, $2)
         ON CONFLICT (provider, event_id) DO NOTHING
         RETURNING id`,
        [eventId, eventType],
      );
      if (seen.rowCount === 0) {
        await client.query('COMMIT');
        return reply.send({ ok: true, duplicate: true });
      }

      const found = await client.query<PayoutRow>(
        `SELECT * FROM payouts WHERE provider = 'paystack' AND provider_ref = $1 FOR UPDATE`,
        [reference],
      );
      if (found.rows[0]) {
        await client.query('UPDATE payment_events SET payout_id = $1 WHERE id = $2', [found.rows[0].id, seen.rows[0].id]);
        const outcome = eventType === 'transfer.success' ? 'paid' : 'failed';
        const reason = outcome === 'failed' ? String(event.data?.gateway_response ?? eventType) : undefined;
        if (eventType === 'transfer.reversed' && found.rows[0].status === 'paid') {
          await reversePayout(client, found.rows[0], reason ?? 'Transfer reversed');
        } else {
          await settlePayout(client, found.rows[0], outcome, reason);
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return reply.send({ ok: true });
  });
}
