import jwt from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { findUserById, type UserRow } from './db.js';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

function tokenFrom(request: FastifyRequest): string {
  const header = request.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = tokenFrom(request);
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    reply.code(401).send({ error: 'Sign in to continue.' });
    return;
  }
  request.userId = userId;
}

export function requireRole(...roles: Array<UserRow['role']>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = tokenFrom(request);
    const userId = token ? verifyToken(token) : null;
    if (!userId) {
      reply.code(401).send({ error: 'Sign in to continue.' });
      return;
    }
    const user = await findUserById(userId);
    if (!user) {
      reply.code(401).send({ error: 'Account not found.' });
      return;
    }
    if (!roles.includes(user.role)) {
      reply.code(403).send({ error: 'You do not have access to this resource.' });
      return;
    }
    request.userId = userId;
  };
}
