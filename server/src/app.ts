import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { initMonitoring, captureError } from './monitoring.js';
import authRoutes from './routes/auth.js';
import collectionRoutes from './routes/collections.js';
import walletRoutes from './routes/wallet.js';
import miscRoutes from './routes/misc.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    bodyLimit: 64 * 1024,
    trustProxy: config.trustProxy,
  });

  await initMonitoring(app.log);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : !config.isProduction,
  });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });

  await app.register(miscRoutes);
  await app.register(authRoutes);
  await app.register(collectionRoutes);
  await app.register(walletRoutes);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled request error');
      captureError(error);
      return reply.code(500).send({ error: 'Something went wrong.' });
    }
    return reply.code(statusCode).send({ error: error.message });
  });

  return app;
}
