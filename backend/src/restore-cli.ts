/**
 * Database restore CLI
 * Usage: npm run db:restore -- /path/to/movienight_YYYYMMDD_HHmmss.json
 *
 * Restores movies, users, and kometa_schedule from a backup produced by the
 * built-in backup scheduler or a triggerBackup mutation.
 *
 * WARNING: This truncates the existing data before restoring. Run migrations
 * first so the schema exists (npm run migrate:up).
 */

import fs from 'fs';
import { Pool } from 'pg';
import { BackupData } from './backup';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npm run db:restore -- <backup.json>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const data: BackupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (data.version !== 1) {
    console.error(`Unsupported backup version: ${data.version}`);
    process.exit(1);
  }

  console.log(`Restoring backup from ${data.exported_at}`);
  console.log(`  ${data.movies.length} movies, ${data.users.length} users, ${data.kometa_schedule.length} kometa_schedule rows`);

  const pool = new Pool({
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'movienight',
    user: process.env.DB_USER || 'movienight_user',
    password: process.env.DB_PASSWORD || 'movienight_pass',
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data; CASCADE handles FK deps automatically
    await client.query('TRUNCATE movies, users, kometa_schedule RESTART IDENTITY CASCADE');

    // Insert users first (movies.requested_by FK → users)
    for (const row of data.users) {
      const cols = Object.keys(row);
      const vals = cols.map(c => row[c]);
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders})`,
        vals
      );
    }

    for (const row of data.movies) {
      const cols = Object.keys(row);
      const vals = cols.map(c => row[c]);
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO movies (${cols.join(', ')}) VALUES (${placeholders})`,
        vals
      );
    }

    for (const row of data.kometa_schedule) {
      const cols = Object.keys(row);
      const vals = cols.map(c => row[c]);
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO kometa_schedule (${cols.join(', ')}) VALUES (${placeholders})`,
        vals
      );
    }

    await client.query('COMMIT');
    console.log('Restore complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Restore failed, all changes rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
