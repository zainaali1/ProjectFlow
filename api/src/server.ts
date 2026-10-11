import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { MemoryRepository } from './data/memoryRepository.js';
import type { Repository } from './data/repository.js';

async function main() {
  const config = loadConfig();

  let repo: Repository;
  if (config.dataProvider === 'memory') {
    repo = new MemoryRepository();
    console.log('Using in-memory demo data (DATA_PROVIDER=memory). Changes are lost on restart.');
  } else {
    // Imported lazily so the memory mode does not need the SQL driver configured.
    const { createPool, MssqlRepository } = await import('./data/mssqlRepository.js');
    repo = new MssqlRepository(await createPool(config.sql));
    console.log(`Connected to Azure SQL ${config.sql.server}/${config.sql.database} (${config.sql.auth})`);
  }

  if (config.authMode === 'dev') {
    console.warn('WARNING: AUTH_MODE=dev - authentication is disabled. Never use this outside your own machine.');
  }

  const app = createApp(repo, config);
  const server = app.listen(config.port, () => {
    console.log(`ProjectFlow API listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await repo.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
