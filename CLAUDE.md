# MovieNight — Agent Context

A full-stack movie suggestion app: React + TypeScript frontend, Apollo GraphQL backend, PostgreSQL database. Containerized with Docker Compose.

## Quick orientation

| Layer | Location | Key files |
|---|---|---|
| Frontend | `src/` | `App.tsx`, `src/components/`, `src/graphql/queries.ts`, `src/contexts/AuthContext.tsx` |
| Backend | `backend/src/` | `index.ts`, `schema.ts`, `resolvers.ts`, `db.ts`, `auth.ts` |
| DB migrations | `backend/migrations/` | numbered JS files run by node-pg-migrate |
| Docker | root | `docker-compose.yml`, `Dockerfile`, `nginx.conf` |
| Backend Docker | `backend/` | `backend/Dockerfile` |

## Running the project

```bash
# Start everything (recommended)
docker-compose up -d
# Frontend → http://localhost:3000
# GraphQL  → http://localhost:4000/graphql
# Postgres → localhost:5432

# Local dev without Docker
npm install && npm start            # frontend
cd backend && npm install && npm run dev  # backend (needs Postgres separately)

# Build
npm run build                       # frontend (CRA)
cd backend && npm run build         # backend (tsc)

# Migrations (run automatically on backend startup)
cd backend && npm run migrate:up
cd backend && npm run migrate:down
cd backend && npm run migrate:create <name>
```

## Architecture

- **Frontend**: React 18 + TypeScript, Apollo Client 3, MUI Joy, Styled Components
- **Backend**: Node 18/20, Apollo Server 4 + Express, pg (no ORM), bcrypt + JWT
- **Database**: PostgreSQL 15
- **Auth**: JWT (7-day expiry) stored in localStorage, sent as `Authorization: Bearer <token>`. Context injected per-request in `backend/src/index.ts`.
- **Ranking**: Movies ordered by `rank NUMERIC(20,10)` using fractional indexing; new movies appended at `MAX(rank) + 1`.
- **Polling**: `GET_MOVIES` query polls every 5 s (`pollInterval: 5000`).

## GraphQL schema (brief)

```graphql
# Queries
movies: [Movie!]!         # all movies ordered by rank
movie(id: ID!): Movie
me: User                  # requires auth
users: [User!]!           # admin only
user(id: ID!): User       # admin only

# Mutations
addMovie(title, requester): Movie!    # requires auth
deleteMovie(id): Boolean!             # requires auth
login(username, password): AuthPayload!
createUser / updateUser / deleteUser  # admin only
```

All GraphQL operations are defined in `src/graphql/queries.ts`.

## Key conventions

- **No ORM** — raw SQL via `pg` pool (`backend/src/db.ts`). Use parameterised queries (`$1, $2, …`).
- **Authorization** — check `context.user` (authenticated) or `context.user?.isAdmin` (admin) in resolvers; throw `GraphQLError` with appropriate `extensions.code`.
- **Field resolvers** — timestamps returned from Postgres are converted to ISO 8601 in `Movie.date_submitted`, `User.created_at/updated_at` field resolvers in `resolvers.ts`.
- **Frontend state** — auth state lives in `AuthContext`; movie/user data comes from Apollo cache.
- **Component structure** — feature folders under `src/components/` (auth, home, admin, common).
- **Env vars** — frontend uses `REACT_APP_*`; backend uses bare names. See `.env.example` / `backend/.env.example`.

## Known bugs (as of inspection)

| File | Line | Issue |
|---|---|---|
| `backend/src/schema.ts` | 30–33 | Duplicate `type Query { … }` block — inner block shadows some fields |
| `backend/src/index.ts` | 33 | Duplicate `expressMiddleware(server)` call (missing comma / copy-paste) |
| `src/index.tsx` | ~19 | `<App />` rendered twice in the provider tree |

## Environment variables

**Frontend** (`.env`):
- `REACT_APP_GRAPHQL_URL` — defaults to `http://localhost:4000/graphql`

**Backend** (`backend/.env`):
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `PORT` (default 4000)
- `JWT_SECRET` — **change in production**
- `ADMIN_PASSWORD` — seeds the default admin user (default `admin123`, **change in production**)

## CI/CD

- `dev` branch push → `.github/workflows/test-build.yml` (build only, no push)
- `master` branch push → `.github/workflows/deploy.yml` (build → push GHCR → SSH deploy to remote host on port 8080 at `/movienight/`)

## Existing docs

- `README.md` — quick-start and API examples
- `AUTHENTICATION.md` — JWT flow, default credentials, user management
- `DEPLOYMENT.md` — CI/CD setup, SSH keys, GHCR config
- `backend/MIGRATIONS.md` — migration conventions
