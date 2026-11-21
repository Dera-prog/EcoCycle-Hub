import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { seedDemoData } from './seed.js';

const app = await buildApp();

try {
  if (config.seedDemo) await seedDemoData();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`EcoCycle Hub API listening on :${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} received, shutting down`);
  try {
    await app.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
