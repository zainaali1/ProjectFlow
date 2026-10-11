/**
 * Creates the database tables by running database/schema.sql.
 *   npm run db:migrate
 * WARNING: schema.sql drops and recreates the tables - existing data is lost.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/data/mssqlRepository.js';

const schemaPath = fileURLToPath(new URL('../../database/schema.sql', import.meta.url));

const config = loadConfig();
const pool = await createPool(config.sql);
try {
  const script = await readFile(schemaPath, 'utf8');
  // "GO" is a tool command, not T-SQL, so run each batch separately.
  const batches = script.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  for (const batch of batches) {
    await pool.request().batch(batch);
  }
  console.log(`Schema applied to ${config.sql.database} (${batches.length} batches).`);
} finally {
  await pool.close();
}
