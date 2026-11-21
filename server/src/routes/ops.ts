import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth.js';
import { pool } from '../db.js';

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
}
