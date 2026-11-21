import Fastify from 'fastify';
import cors from '@fastify/cors';
import { migrateAndSeed } from './db.js';
import authRoutes from './routes/auth.js';
import collectionRoutes from './routes/collections.js';
import walletRoutes from './routes/wallet.js';
import miscRoutes from './routes/misc.js';

const PORT = Number(process.env.PORT ?? 4000);
const origin = process.env.CORS_ORIGIN ?? true;

const app = Fastify({ logger: true });

await app.register(cors, { origin });
await app.register(miscRoutes);
await app.register(authRoutes);
await app.register(collectionRoutes);
await app.register(walletRoutes);

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code(500).send({ error: 'Something went wrong.' });
});

async function start() {
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await migrateAndSeed();
      break;
    } catch (err) {
      if (attempt === 20) throw err;
      app.log.warn(`Database not ready (attempt ${attempt}); retrying in 2s`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`EcoCycle Hub API listening on :${PORT}`);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
