import { fileURLToPath, pathToFileURL } from 'node:url';
import { runner } from 'node-pg-migrate';
import { config } from './config.js';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

export async function runMigrations(
  databaseUrl = config.databaseUrl,
  direction: 'up' | 'down' = 'up',
): Promise<void> {
  await runner({
    databaseUrl,
    dir: migrationsDir,
    direction,
    count: direction === 'down' ? 1 : Infinity,
    migrationsTable: 'pgmigrations',
    log: (message) => console.log(message),
  });
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  runMigrations(config.databaseUrl, direction).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
