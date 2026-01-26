import { Pool } from 'pg';
import path from 'path';
import migrate from 'node-pg-migrate';

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'movienight',
  user: process.env.DB_USER || 'movienight_user',
  password: process.env.DB_PASSWORD || 'movienight_pass',
});

export const initializeDatabase = async () => {
  try {
    // Run database migrations
    await migrate({
      databaseUrl: {
        host: process.env.DB_HOST || 'db',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'movienight',
        user: process.env.DB_USER || 'movienight_user',
        password: process.env.DB_PASSWORD || 'movienight_pass',
      },
      dir: path.join(__dirname, '../migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      log: (msg: string) => console.log(msg),
    });

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running database migrations:', error);
    throw error;
  }
};

export default pool;
