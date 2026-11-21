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

  app.get('/api/service-areas', async (_request, reply) => {
    const { rows } = await pool.query<{
      key: string;
      name: string;
      city: string;
      category: string;
      rate: number;
    }>(
      `SELECT sa.key, sa.name, sa.city, r.category, r.rate
       FROM service_areas sa
       JOIN service_area_rates r ON r.area_key = sa.key
       WHERE sa.active
       ORDER BY sa.name, r.category`,
    );

    const areas = new Map<string, { key: string; name: string; city: string; rates: Record<string, number> }>();
    for (const row of rows) {
      const area = areas.get(row.key) ?? { key: row.key, name: row.name, city: row.city, rates: {} };
      area.rates[row.category] = Number(row.rate);
      areas.set(row.key, area);
    }
    return reply.send({ areas: [...areas.values()] });
  });
}
