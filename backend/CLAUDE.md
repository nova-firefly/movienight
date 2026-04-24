# Backend — Agent Context

Apollo Server 4 + Express + PostgreSQL. TypeScript, no ORM, raw `pg` queries.

## Entry point & startup sequence

`src/index.ts`:

1. Create Express app + ApolloServer
2. Mount `/graphql` with CORS, JSON body parser, `expressMiddleware` (JWT context)
3. Call `initializeDatabase()` (runs migrations, seeds admin user)
4. Listen on `PORT` (default 4000)

> **Bug**: line 33 has a duplicate `expressMiddleware(server)` call without a comma — this is a syntax error that prevents compilation. Remove the duplicate line.

## Source files

| File                 | Purpose                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/index.ts`       | Server bootstrap, Express setup, JWT context injection                                                 |
| `src/schema.ts`      | GraphQL SDL (`typeDefs`). **Bug**: duplicate `type Query` block at lines 30–33 — remove it.            |
| `src/resolvers.ts`   | All Query/Mutation resolvers + field resolvers for timestamp conversion                                |
| `src/db.ts`          | `pg.Pool` setup + `initializeDatabase()` (runs migrations, creates admin user)                         |
| `src/auth.ts`        | `hashPassword`, `comparePassword` (bcrypt), `generateToken`, `verifyToken` (JWT), `getTokenFromHeader` |
| `src/models/User.ts` | TypeScript interfaces: `User`, `CreateUserInput`, `UpdateUserInput`                                    |

## Database

- **Driver**: `pg` pool — import `pool` from `./db`, use `pool.query(sql, params)`.
- **Parameterised queries only** — never interpolate user input into SQL strings.
- **Tables**: `movies` (id, title, requester, date_submitted, rank), `users` (id, username, email, password_hash, is_admin, created_at, updated_at).
- **Migrations**: `migrations/` directory, run via `node-pg-migrate`. File naming: `<timestamp>_<description>.js`.
- New migration: `npm run migrate:create <name>` → edit the generated file → `npm run migrate:up`.

## Auth pattern in resolvers

```ts
// Authenticated only
if (!context.user)
  throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });

// Admin only
if (!context.user?.isAdmin)
  throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
```

`context.user` shape (from `verifyToken`): `{ userId: number, isAdmin: boolean }`.

## Ranking system

Movies have a `rank NUMERIC(20,10)` column. Ordering: `ORDER BY rank ASC`. New movies: `MAX(rank) + 1`. For re-ordering between two items use a midpoint value (fractional indexing).

## Scripts

```bash
npm run dev          # ts-node-dev with --respawn (hot reload)
npm run build        # tsc → dist/
npm start            # node dist/index.js
npm run migrate:up
npm run migrate:down
npm run migrate:create <name>
```

## Docker

`backend/Dockerfile` — Node 18 (build) + Node 20 Alpine (production). Runs migrations on container start via `CMD`.
