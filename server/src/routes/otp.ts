import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { normalizePhone } from '../phone.js';
import { findUserByPhone, pool, snapshotFor } from '../db.js';
import { signToken } from '../auth.js';
import { sendSms, smsConfigured } from '../sms.js';

interface RequestBody {
  phone?: string;
}

interface VerifyBody {
  phone?: string;
  code?: string;
  name?: string;
}

const requestLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };
const verifyLimit = { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } };

function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export default async function otpRoutes(app: FastifyInstance) {
  app.post<{ Body: RequestBody }>('/api/auth/otp/request', requestLimit, async (request, reply) => {
    if (!smsConfigured()) {
      return reply
        .code(503)
        .send({ error: 'Phone sign-in is not configured on this server yet. Use email and password.' });
    }

    const phone = normalizePhone(request.body.phone ?? '');
    if (!phone) return reply.code(400).send({ error: 'Enter a valid Nigerian phone number.' });

    const { rows } = await pool.query<{ created_at: string }>(
      'SELECT created_at FROM otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
      [phone],
    );
    if (rows[0] && Date.now() - new Date(rows[0].created_at).getTime() < config.otp.resendSeconds * 1000) {
      return reply.code(429).send({ error: 'Please wait a moment before requesting another code.' });
    }

    const code = newCode();
    const codeHash = await bcrypt.hash(code, 10);
    await pool.query('UPDATE otp_codes SET consumed_at = now() WHERE phone = $1 AND consumed_at IS NULL', [phone]);
    await pool.query(
      `INSERT INTO otp_codes (phone, code_hash, purpose, expires_at)
       VALUES ($1, $2, 'signin', now() + ($3 || ' seconds')::interval)`,
      [phone, codeHash, config.otp.ttlSeconds],
    );

    await sendSms(phone, `${code} is your EcoCycle verification code. It expires in ${Math.ceil(config.otp.ttlSeconds / 60)} minutes.`);

    return reply.send({
      ok: true,
      phone,
      expiresIn: config.otp.ttlSeconds,
      ...(config.isProduction ? {} : { devCode: code }),
    });
  });

  app.post<{ Body: VerifyBody }>('/api/auth/otp/verify', verifyLimit, async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    if (!phone) return reply.code(400).send({ error: 'Enter a valid Nigerian phone number.' });
    const code = (request.body.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) return reply.code(400).send({ error: 'Enter the 6-digit code.' });
    const name = (request.body.name ?? '').trim();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{
        id: string;
        code_hash: string;
        attempts: number;
        expires_at: string;
      }>(
        `SELECT id, code_hash, attempts, expires_at FROM otp_codes
         WHERE phone = $1 AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [phone],
      );
      const otp = rows[0];
      if (!otp) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'Request a code first.' });
      }
      if (new Date(otp.expires_at).getTime() <= Date.now()) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'That code has expired. Request a new one.' });
      }
      if (otp.attempts >= config.otp.maxAttempts) {
        await client.query('ROLLBACK');
        return reply.code(429).send({ error: 'Too many incorrect attempts. Request a new code.' });
      }

      if (!(await bcrypt.compare(code, otp.code_hash))) {
        await client.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
        await client.query('COMMIT');
        return reply.code(400).send({ error: 'That code is incorrect.' });
      }

      let user = await findUserByPhone(phone);
      if (!user && name.length < 2) {
        await client.query('ROLLBACK');
        return reply.code(400).send({
          error: 'This number is new — enter your full name to create your account.',
          needsName: true,
        });
      }

      await client.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otp.id]);

      if (!user) {
        const unusablePassword = await bcrypt.hash(randomUUID(), 10);
        const created = await client.query<{ id: string }>(
          `INSERT INTO users (name, phone, password_hash, persona, tier, phone_verified_at)
           VALUES ($1, $2, $3, 'new', 'New Recycler', now()) RETURNING id`,
          [name, phone, unusablePassword],
        );
        await client.query('INSERT INTO bank_accounts (user_id, bank_name, last4) VALUES ($1, $2, $3)', [
          created.rows[0].id,
          'No payout account',
          '',
        ]);
      } else {
        await client.query('UPDATE users SET phone_verified_at = now() WHERE id = $1', [user.id]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: 'That number is already registered. Request a new code to sign in.' });
      }
      throw error;
    } finally {
      client.release();
    }

    const user = await findUserByPhone(phone);
    if (!user) return reply.code(500).send({ error: 'Could not complete sign-in.' });
    const state = await snapshotFor(user.id);
    return reply.send({ token: signToken(user.id), state });
  });
}
