import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { initializeDatabase } from './db';
import pool from './db';
import { verifyToken, getTokenFromHeader } from './auth';
import { initScheduler } from './scheduler';
import { initBackupScheduler } from './backup';

const PORT = process.env.PORT || 4000;

async function startServer() {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    }),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const token = getTokenFromHeader(req.headers.authorization);
        let user = token ? verifyToken(token) : null;

        // Revalidate JWT claims against DB to catch demoted/deactivated users
        if (user) {
          try {
            const dbUser = await pool.query('SELECT is_admin, is_active FROM users WHERE id = $1', [
              user.userId,
            ]);
            if (dbUser.rows.length === 0 || !dbUser.rows[0].is_active) {
              user = null; // User deleted or deactivated
            } else {
              user = { ...user, isAdmin: dbUser.rows[0].is_admin };
            }
          } catch {
            // On DB error, fall back to JWT claims rather than blocking all requests
          }
        }

        const ipAddress =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
        const userAgent = (req.headers['user-agent'] as string) || 'unknown';
        return { user, ipAddress, userAgent };
      },
    }),
  );

  await initializeDatabase();
  await initScheduler();
  initBackupScheduler();

  // Clean up expired password reset tokens every hour
  setInterval(
    async () => {
      try {
        await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
      } catch (err) {
        console.error('Failed to clean expired reset tokens:', err);
      }
    },
    60 * 60 * 1000,
  ).unref();

  app.listen(PORT, () => {
    console.log(`🚀 GraphQL server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
