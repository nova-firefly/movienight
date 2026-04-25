import { Pool } from 'pg';
import path from 'path';
// node-pg-migrate v8 is ESM-only; use dynamic import in CJS
const loadMigrate = () => import('node-pg-migrate').then((m) => m.runner);
import { hashPassword } from './auth';

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'movienight',
  user: process.env.DB_USER || 'movienight_user',
  password: process.env.DB_PASSWORD || 'movienight_pass',
});

const seedAdminUser = async () => {
  try {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await hashPassword(defaultPassword);

    await pool.query(
      `INSERT INTO users (username, email, password_hash, is_admin)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = EXCLUDED.is_admin`,
      ['admin', 'admin@movienight.local', passwordHash, true],
    );

    console.log('✅ Admin user ensured (username: admin)');
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
};

const seedTestUser = async () => {
  try {
    const username = process.env.TEST_USER_USERNAME || 'testuser';
    const password = process.env.TEST_USER_PASSWORD || 'testpass';
    const passwordHash = await hashPassword(password);

    await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name, is_admin)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [username, `${username}@movienight.local`, passwordHash, 'Test User', false],
    );

    console.log(`✅ Test user ensured (username: ${username})`);
  } catch (error) {
    console.error('Error seeding test user:', error);
  }
};

export const initializeDatabase = async () => {
  try {
    // Run database migrations
    const migrate = await loadMigrate();
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
      checkOrder: false,
      log: (msg: string) => console.log(msg),
    });

    console.log('Database migrations completed successfully');

    await seedAdminUser();

    if (process.env.NODE_ENV !== 'production') {
      await seedTestUser();
    }
  } catch (error) {
    console.error('Error running database migrations:', error);
    throw error;
  }
};

export default pool;
