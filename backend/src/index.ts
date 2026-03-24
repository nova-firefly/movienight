import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { initializeDatabase } from './db';
import { verifyToken, getTokenFromHeader } from './auth';

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
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const token = getTokenFromHeader(req.headers.authorization);
        const user = token ? verifyToken(token) : null;
        const ipAddress =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          req.ip ||
          'unknown';
        const userAgent = (req.headers['user-agent'] as string) || 'unknown';
        return { user, ipAddress, userAgent };
      },
    })
  );

  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 GraphQL server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
