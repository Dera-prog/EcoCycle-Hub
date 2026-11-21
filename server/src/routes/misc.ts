import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export default async function miscRoutes(app: FastifyInstance) {
  app.get('/api/live', async (_request, reply) => {
    return reply.send({ ok: true });
  });

  app.get('/api/health', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return reply.send({ ok: true, db: true });
    } catch {
      return reply.code(503).send({ ok: false, db: false });
    }
  });

  app.get('/api/categories', async (_request, reply) => {
    const { rows } = await pool.query('SELECT key, name, rate FROM categories ORDER BY rate DESC');
    return reply.send({ categories: rows });
  });
}
