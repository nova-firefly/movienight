# Backend — Agent Context

Apollo Server 4 + Express + PostgreSQL. TypeScript, no ORM, raw `pg` queries.

See the root `CLAUDE.md` for the GraphQL surface, the full database schema, audit actions and
project-wide gotchas. This file covers backend-only detail.

> **Last verified:** 2026-09-15 against branch `60a7-tv-shows-ui`.

## Entry point & startup sequence

`src/index.ts`:

1. Create Express app + `ApolloServer`.
2. Mount `/graphql` with CORS (`CORS_ORIGIN`, default `http://localhost:3000`), `express.json()` and
   `expressMiddleware(server, { context })`.
3. The context builder parses the `Authorization` header, verifies the JWT, then **re-queries
   `users.is_admin` / `is_active` on every request** so demoted or deactivated users lose access
   without waiting for token expiry. Context shape:
   `{ user: { userId, isAdmin, username } | null, ipAddress, userAgent }`.
4. `initializeDatabase()` — runs migrations, seeds the admin user, and (outside production) a test
   user.
5. `initScheduler()` — production only.
6. Listen on `PORT` (default 4000).

## Source files

| File                | Purpose                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `index.ts`          | Bootstrap, Express setup, JWT context + DB revalidation                                          |
| `schema.ts`         | GraphQL SDL (`typeDefs`) — one `type Query`, one `type Mutation`, no subscriptions               |
| `resolvers.ts`      | All resolvers (~2400 lines) + field resolvers                                                    |
| `db.ts`             | `pg.Pool` + `initializeDatabase()`                                                               |
| `auth.ts`           | `hashPassword`, `comparePassword` (bcrypt), `generateToken`, `verifyToken`, `getTokenFromHeader` |
| `elo.ts`            | `calculateElo` (K = 32, base 1000), `getOrCreateElo`, `applyComparison`, `updateGlobalEloRank`   |
| `pairSelection.ts`  | `selectPair` — three-tier selection, pure, no DB access                                          |
| `tmdb.ts`           | Kind-dispatched TMDB adapter (`movie` \| `show`)                                                 |
| `contentActions.ts` | `logAudit`, `triggerMdblistSyncInBackground`, `CONTENT_TABLE`, `AUDIT_TARGET_TYPE`               |
| `kometaExport.ts`   | `runKometaExport` — MDBList sync, Kometa YAML, Plex reconcile                                    |
| `mdblist.ts`        | MDBList API client (`createList`, `syncList`)                                                    |
| `plexClient.ts`     | Plex API client                                                                                  |
| `push.ts`           | Web Push delivery + subscription pruning                                                         |
| `scheduler.ts`      | Scheduled export timer                                                                           |
| `email.ts`          | nodemailer transport                                                                             |
| `models/User.ts`    | `User`, `CreateUserInput`, `UpdateUserInput` interfaces                                          |

## Database

- Import `pool` from `./db`; use `pool.query(sql, params)`.
- **Parameterised values only** — never interpolate user input into SQL.
- Migrations live in `migrations/`, run by `node-pg-migrate`, named `<timestamp>_<description>.js`.
  New migration: `npm run migrate:create <name>` → edit → `npm run migrate:up`. They also run
  automatically on container start. See `MIGRATIONS.md`.
- node-pg-migrate wraps each migration in a transaction, so `CREATE INDEX CONCURRENTLY` is not
  available. Small tables use drop-and-recreate for constraint changes; that precedent is set by
  `1746600000000` and `1748000005000`.
- Full current schema: root `CLAUDE.md`.

## Auth pattern in resolvers

```ts
// Authenticated only
if (!context.user)
  throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });

// Admin only
if (!context.user?.isAdmin)
  throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
```

Owner-or-admin checks fetch the row first and compare `requested_by` against `context.user.userId`.
`markWatched` additionally allows an accepted connection of the owner — see the root `CLAUDE.md`
gotchas before changing either gate.

## Ranking

Pairwise Elo. `user_movie_elo` holds per-user ratings; `movies.elo_rank` caches the cross-user
average and is refreshed by `updateGlobalEloRank` after each comparison. `applyComparison` is **not**
transactional — it issues sequential statements.

`movies.rank` is a dead column from the pre-Elo era: still `NOT NULL`, still written as `0` on
insert, never read for ordering and never exposed in GraphQL.

## Background work

`fetchAndStoreTmdbData`, `triggerMdblistSyncInBackground` and push fan-out are all fire-and-forget:
called without `await`, with their own internal try/catch, so mutation latency and success never
depend on them. Keep it that way — and keep their errors logged rather than thrown.

## Scripts

```bash
npm run dev          # ts-node-dev --respawn --transpile-only
npm run build        # tsc → dist/
npm start            # node dist/index.js
npm test             # jest (361 tests)
npm run test:watch
npm run test:coverage
npm run lint         # eslint src/
npm run format       # prettier --write 'src/**/*.ts'
npm run migrate:up | migrate:down | migrate:create <name>
```

## Testing

Suites in `src/__tests__/`, with resolver tests split by domain under `src/__tests__/resolvers/`
(shared mocks and context factories in `__helpers.ts`). Coverage thresholds in `jest.config.ts`,
enforced in CI: 80% statements/lines/functions, 65% branches.

Every new function needs tests; every new resolver needs happy path, auth/authz, and at least two
error/edge cases.

## Docker

`backend/Dockerfile` — Node 18 build stage, Node 20 Alpine runtime. Runs migrations on start via
`CMD`.
