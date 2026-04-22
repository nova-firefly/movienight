import { Pool } from 'pg';
import path from 'path';
import migrate from 'node-pg-migrate';
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
    const result = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);

    if (result.rows.length === 0) {
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const passwordHash = await hashPassword(defaultPassword);

      await pool.query(
        'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4)',
        ['admin', 'admin@movienight.local', passwordHash, true]
      );

      console.log('✅ Admin user created successfully');
      console.log('   Username: admin');
      console.log(`   Password: ${defaultPassword}`);
      console.log('   ⚠️  Please change this password after first login!');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
};

const seedTestUser = async () => {
  try {
    const username = process.env.TEST_USER_USERNAME || 'testuser';
    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      const password = process.env.TEST_USER_PASSWORD || 'testpass';
      const passwordHash = await hashPassword(password);

      await pool.query(
        'INSERT INTO users (username, email, password_hash, display_name, is_admin) VALUES ($1, $2, $3, $4, $5)',
        [username, `${username}@movienight.local`, passwordHash, 'Test User', false]
      );

      console.log(`✅ Test user created: ${username}`);
    } else {
      console.log(`Test user '${username}' already exists`);
    }
  } catch (error) {
    console.error('Error seeding test user:', error);
  }
};

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

    // Seed admin user after migrations
    await seedAdminUser();

    // Seed test user in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      await seedTestUser();
    }
  } catch (error) {
    console.error('Error running database migrations:', error);
    throw error;
  }
};

export default pool;
