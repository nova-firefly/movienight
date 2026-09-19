# MovieNight — Agent Context

A full-stack movie suggestion app: React + TypeScript frontend, Apollo GraphQL backend, PostgreSQL
database. Containerized with Docker Compose. Movies are ranked by pairwise Elo, shared with
"connections", and exported to Plex via MDBList + Kometa.

> **Last verified:** 2026-09-15 against branch `phase-2-show-graphql` (TV shows Phase 2). If
> something here contradicts the code, trust the code and fix this file.

## Quick orientation

| Layer          | Location              | Key files                                                                                |
| -------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| Frontend       | `src/`                | `App.tsx`, `src/components/`, `src/graphql/queries.ts`, `src/contexts/AuthContext.tsx`   |
| Backend        | `backend/src/`        | `index.ts`, `schema.ts`, `resolvers.ts`, `db.ts`, `auth.ts`, `elo.ts`, `kometaExport.ts` |
| DB migrations  | `backend/migrations/` | 33 numbered JS files run by node-pg-migrate                                              |
| Docker         | root                  | `docker-compose.yml`, `Dockerfile`, `nginx.conf`                                         |
| Backend Docker | `backend/`            | `backend/Dockerfile`                                                                     |
| Specs          | `specs/`              | `tv-shows.spec.md`, `push-notifications.spec.md`, `this-or-that.spec.md`, `mockups/`     |

## Running the project

```bash
docker-compose up -d                      # Frontend :3000, GraphQL :4000/graphql, Postgres :5432
npm install && npm start                  # frontend without Docker
cd backend && npm install && npm run dev  # backend without Docker (needs Postgres)

npm run build                             # frontend (CRA)
cd backend && npm run build               # backend (tsc)

cd backend && npm run migrate:up          # migrations also run automatically on backend startup
cd backend && npm run migrate:down
cd backend && npm run migrate:create <name>
```

## Architecture

- **Frontend**: React 18 + TypeScript, Apollo Client 3, MUI Joy (dark mode only), Emotion,
  `lucide-react` icons, `md5` for gravatar. CRA (`react-scripts`).
- **Backend**: Node 18/20, Apollo Server 4 + Express, `pg` (no ORM), bcrypt + JWT, `web-push`,
  `nodemailer`.
- **Database**: PostgreSQL 15.
- **Auth**: JWT (7-day expiry) in localStorage, sent as `Authorization: Bearer <token>`. Context is
  injected per-request in `backend/src/index.ts`, which **re-validates the JWT against the DB on
  every request** so demoted or deactivated users lose access immediately.
- **Ranking**: pairwise Elo. `user_movie_elo` holds per-user ratings; `movies.elo_rank` caches the
  cross-user average. See "Gotchas" about the dead `movies.rank` column.
- **Polling**: the app polls rather than subscribing — `GET_MOVIES` every 5 s, connection/inbox
  queries every 10 s, `soloMovies` every 15 s. There is no GraphQL subscription support.
- **Production gating**: Kometa file export and the scheduler require `NODE_ENV === 'production'`.
  `appInfo.isProduction` exposes this to the frontend. Note `syncMdblist` is **not** production-gated
  — it runs in dev against `[DEV] `-prefixed lists.

## GraphQL schema

Authoritative source: `backend/src/schema.ts`. All client operations live in `src/graphql/queries.ts`.

```graphql
# Queries
appInfo: AppInfo!                                      # isProduction, vapidPublicKey, quickLoginUsers
movies: [Movie!]!                                      # unwatched only; personal Elo order when authed
movie(id: ID!): Movie                                  # public
me: User
users: [User!]!                                        # admin only
user(id: ID!): User                                    # admin only
auditLogs(limit: Int, offset: Int): [AuditLog!]!       # admin only
loginHistory(userId: ID, limit: Int): [LoginHistory!]! # admin only
searchTmdb(query: String!): [TmdbMovie!]!              # needs TMDB_API_KEY
kometaSchedule: KometaSchedule!                        # admin only
thisOrThat(excludeIds: [ID!]): ThisOrThatPair!         # pairwise comparison
myRankings: [MovieRanking!]!
searchUsers(query: String!): [ConnectionUser!]!
myConnections: [UserConnection!]!
pendingConnectionRequests: [UserConnection!]!
combinedList(connectionId: ID!): CombinedListResult!
newMoviesFromConnections: [PendingReviewMovie!]!
soloMovies: [Movie!]!
passedMovieIds: [ID!]!
tags: [Tag!]!
watchedMovies(limit: Int, offset: Int): [Movie!]!      # limit clamped 1..200, default 50
notificationPreferences: [NotificationPreference!]!
# Shows — parallel to movies, separate Elo pool (never mixed). See tv-shows.spec.md.
shows: [Show!]!                                        # unwatched only; personal Elo order when authed
show(id: ID!): Show                                    # public
searchTmdbShows(query: String!): [TmdbShow!]!          # needs TMDB_API_KEY; /search/tv
showThisOrThat(excludeIds: [ID!]): ThisOrThatShowPair!
myShowRankings: [ShowRanking!]!
combinedShowList(connectionId: ID!): CombinedShowListResult!
newShowsFromConnections: [PendingReviewShow!]!
soloShows: [Show!]!
passedShowIds: [ID!]!
watchedShows(limit: Int, offset: Int): [Show!]!        # limit clamped 1..200, default 50

# Mutations
addMovie(title: String!, tmdb_id: Int): Movie!
matchMovie(id: ID!, tmdb_id: Int!, title: String!): Movie!
markWatched(id: ID!): Movie!                           # owner, admin, OR accepted connection of owner
unwatchMovie(id: ID!): Movie!                          # owner or admin only (deliberately stricter)
deleteMovie(id: ID!): Boolean!                         # admin only
recordComparison(winnerId: ID!, loserId: ID!): ComparisonResult!
resetMovieComparisons(movieId: ID!): Boolean!
setMovieInterest(movieId: ID!, interested: Boolean!): SetInterestResult!
setMovieTag(movieId: ID!, tagSlug: String!, value: String): MovieUserTag!
removeMovieTag(movieId: ID!, tagSlug: String!): Boolean!
sendConnectionRequest(addresseeId: ID!): UserConnection!
respondToConnectionRequest(connectionId: ID!, accept: Boolean!): UserConnection!
removeConnection(connectionId: ID!): Boolean!
exportKometa: KometaExportResult!                      # admin + production
syncMdblist: KometaExportResult!                       # admin, any environment
updateKometaSchedule(enabled: Boolean, frequency: String, dailyTime: String): KometaSchedule!
setMdblistApiKey(apiKey: String!): KometaSchedule!
importFromLetterboxd(url: String!): ImportResult!      # admin only
login / createUser / updateUser / deleteUser
requestPasswordReset(email: String!) / resetPassword(token: String!, newPassword: String!)
subscribePush(subscription: PushSubscriptionInput!): Boolean!   # rate-limited 20/hr/user
unsubscribePush(endpoint: String!): Boolean!
updateNotificationPreference(eventType: String!, enabled: Boolean!): NotificationPreference!
seedMovies: Int!                                       # admin, blocked in production
backfillTmdbData: Int!                                 # admin
# Shows — mirror the movie mutations against the show tables
addShow(title: String!, tmdb_id: Int): Show!           # fires SHOW_ADD push to accepted connections
matchShow(id: ID!, tmdb_id: Int!, title: String!): Show!   # owner or admin
markShowWatched(id: ID!): Show!                        # owner, admin, OR accepted connection of owner
unwatchShow(id: ID!): Show!                            # owner or admin only (deliberately stricter)
deleteShow(id: ID!): Boolean!                          # admin only
recordShowComparison(winnerId: ID!, loserId: ID!): ShowComparisonResult!
resetShowComparisons(showId: ID!): Boolean!
setShowInterest(showId: ID!, interested: Boolean!): SetShowInterestResult!
setShowTag(showId: ID!, tagSlug: String!, value: String): ShowUserTag!
removeShowTag(showId: ID!, tagSlug: String!): Boolean!
setShowProgress(id: ID!, season: Int, episode: Int): Show!  # owner/admin/connection; both args set, or omit both to clear
backfillShowTmdbData: Int!                             # admin
```

**There is no `reorderMovie`.** Drag-to-rank was removed when Elo landed.

## Backend source files

| File                | Purpose                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`          | Bootstrap, Express, CORS, JWT context + per-request DB revalidation                                                                                                                            |
| `schema.ts`         | GraphQL SDL (`typeDefs`)                                                                                                                                                                       |
| `resolvers.ts`      | All resolvers (~2400 lines) + field resolvers for timestamp conversion                                                                                                                         |
| `db.ts`             | `pg.Pool`, `initializeDatabase()` — runs migrations, seeds admin + test user                                                                                                                   |
| `auth.ts`           | bcrypt hashing, JWT generate/verify, `getTokenFromHeader`                                                                                                                                      |
| `elo.ts`            | Elo maths; `getOrCreateElo`/`applyComparison`/`updateGlobalEloRank` are kind-parameterised                                                                                                     |
| `pairSelection.ts`  | Three-tier pair selection (pure, no DB); `ContentCandidate`, kind-agnostic                                                                                                                     |
| `tmdb.ts`           | Kind-dispatched TMDB adapter (movie + show)                                                                                                                                                    |
| `contentActions.ts` | Cross-kind helpers: `logAudit`, `triggerMdblistSyncInBackground`, kind maps, `assertOwnerOrAdmin`/`assertOwnerAdminOrConnection`, `updateWatchedState`, `setInterest`, `upsertTag`/`removeTag` |
| `kometaExport.ts`   | MDBList list sync, Kometa YAML, Plex reconciler                                                                                                                                                |
| `mdblist.ts`        | MDBList API client                                                                                                                                                                             |
| `plexClient.ts`     | Plex API client (section resolve, collections by label, delete)                                                                                                                                |
| `push.ts`           | Web Push (VAPID), subscription pruning on 404/410                                                                                                                                              |
| `scheduler.ts`      | Scheduled Kometa export (production only)                                                                                                                                                      |
| `email.ts`          | nodemailer transport for password resets                                                                                                                                                       |

## Component structure

```
src/components/
├── admin/      AdminPanel, UserManagement, AuditLog, LoginHistory, KometaExport, LetterboxdImport
├── auth/       Login, ForgotPassword, ResetPassword
├── common/     Navbar, Footer, ConfirmDialog, OnboardingGuide, Poster
├── home/       Homepage, ContentRow, ContentCard, AddMovieForm, WatchHistory, WatchHistoryCard,
│               ThisOrThat, MovieCompareCard, ThisOrThatBanner, CombinedList, ConnectionBanners,
│               ConnectionInboxModal, ViewSelector, TmdbMatchFlow
└── settings/   NotificationSettings
```

`src/contexts/` — `AuthContext`, `ToastContext`, `KindContext`. `src/hooks/useConfirm.ts`.
`src/models/` — `Content.ts` (`Movie`, `Show`, `ContentItem`, `ContentKind`, `ViewName`, tag types),
`User.ts`. `src/utils/` — `gravatar`, `pushClient`, `textUtils`, `useDebounce`, `paths` (URL ↔
`{kind, view}`), `tmdb` (`tmdbUrl(kind, id)`).

**Navigation is URL-driven, no router.** `KindContext` (in `src/index.tsx`, inside `AuthProvider`)
owns the `{ kind, view }` route, derived from `location.pathname` via `parsePath` and updated with
`history.pushState` + a `popstate` listener — no react-router. Movies live under `/movies…`, shows
under `/shows…` (`/movies`, `/shows/this-or-that`, `/shows/combined`, `/movies/history`, `/admin`).
`useKind()` exposes `{ kind, view, setKind, navigate }`; `setKind` preserves the current view (D-7)
and persists to `localStorage.contentKind`. `App.tsx` and `Navbar.tsx` read the route from
`useKind()`. `nginx.conf`'s SPA fallback makes deep links refresh-safe.

**Kind is global.** A Movies/Shows segmented toggle in the navbar cascades to every view. Each
kind-scoped view swaps its GraphQL ops by kind (show ops mirror movie ops); `ContentRow`/
`ContentCard` render a kind accent left-border, a `KindChip`, and — for shows — a season/episode
meta line plus an episode-progress chip (hidden until populated). Kind accent tokens: `--mn-kind-*`
in `index.css`. While Shows is active, `KindPalette` (rendered in `App.tsx`) repaints the whole Joy
`primary` palette gold → blue by overriding the `--joy-palette-primary-*` custom properties on
`:root` (values in `SHOW_PALETTE_VARS` in `theme.ts`); Movies keep the default gold.

**"Combined" in the navbar is the Connections manager** (`CombinedList.tsx`), not a ranked list. The
actual combined ranking table is inside `Homepage.tsx`, reached via `ViewSelector`.

## Key conventions

- **No ORM** — raw SQL via `pg`. Always parameterise values (`$1, $2, …`); never interpolate user
  input. The only interpolated identifiers are kind→table names from closed `Record<Kind, string>`
  maps in `contentActions.ts`.
- **Authorization** — check `context.user` (authed) or `context.user?.isAdmin` (admin) in resolvers;
  throw `GraphQLError` with `extensions.code` (`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`,
  `NOT_FOUND`, `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`).
- **Field resolvers** convert Postgres timestamps to ISO 8601 (`Movie.date_submitted`,
  `Movie.watched_at`, `User.*_at`, `AuditLog.created_at`, `LoginHistory.created_at`).
- **`Movie.requester`** resolves from the `requested_by` FK (`display_name || username`), falling
  back to the legacy `movies.requester` varchar, then `'Unknown'`.
- **Posters** are built as `https://image.tmdb.org/t/p/w92${poster_path}` in the `Movie.poster_url`
  field resolver; This-or-That cards build their own at `w342`.
- **Best-effort side effects** — `logAudit` and `triggerMdblistSyncInBackground` swallow their own
  errors so a failed audit or sync never fails a user-visible mutation.
- **Frontend state** — auth in `AuthContext`; everything else from the Apollo cache. The cache has no
  `typePolicies`, so mutations rely on `refetchQueries`.
- **Env vars** — frontend `REACT_APP_*`; backend bare names.

## UI style guide

### Terminology

| Action                         | Verb / button text             | Notes                                              |
| ------------------------------ | ------------------------------ | -------------------------------------------------- |
| Mark a queued movie watched    | **Done** (confirm: `Done`)     | Confirmation: "Mark as done?" / moves to history.  |
| Requeue a watched movie        | **Watch again**                | Confirmation: "Watch again?" / moves to queue end. |
| Tag a movie as previously seen | **Seen it** / "I've seen this" | Per-user `seen` tag.                               |
| Remove from queue (admin)      | **Remove**                     | Destructive — uses danger confirmation.            |

Avoid `Requeue`, `Mark watched`, `Mark complete` as user-facing copy.

### Confirmation severity (`useConfirm` / `ConfirmDialog`)

| Severity | `confirmColor` | When to use                                                                       |
| -------- | -------------- | --------------------------------------------------------------------------------- |
| Danger   | `'danger'`     | Permanent destructive actions: delete movie/user, remove connection, seed, reset. |
| Warning  | `'warning'`    | Recoverable but disruptive actions.                                               |
| Neutral  | `'primary'`    | Reversible state changes (e.g. requeue from history).                             |
| Success  | `'success'`    | Affirmative completion (e.g. mark a movie as done).                               |

Danger and warning confirmations render a leading icon for severity reinforcement.

### Styling

- Prefer MUI `sx` + theme tokens for Joy components. The theme (`src/theme.ts`) defines a **dark
  scheme only**, with a gold `primary` ramp; `index.tsx` pins `defaultMode="dark"`.
- Use CSS variables (`--mn-*` from `index.css`) only for raw HTML elements and global styles.
- Tables are raw `<table>/<tr>/<td>` with inline styles, **not** Joy `<Table>` — which means the
  `JoyTable` override in `theme.ts` is effectively dead code.
- Keep table cell/header styles in module-level `React.CSSProperties` constants.

## Database schema (current — 20 tables)

| Table                           | Notable columns                                                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `movies`                        | id, title, requester (legacy, nullable), requested_by→users, date_submitted, rank (**dead**), elo_rank, tmdb_id, watched_at, poster_path, release_year, director, cast_list[], genre_tags[], tmdb_fetched_at                                        |
| `users`                         | id, username, password_hash, email, display_name, is_admin, is_active, last_login_at, created_at, updated_at                                                                                                                                        |
| `audit_logs`                    | id, actor_id→users, action, target_type, target_id, metadata (jsonb), ip_address, created_at                                                                                                                                                        |
| `login_history`                 | id, user_id→users, ip_address, user_agent, succeeded, created_at                                                                                                                                                                                    |
| `movie_comparisons`             | id, user_id, winner_id→movies, loser_id→movies, created_at — append-only pick log                                                                                                                                                                   |
| `user_movie_elo`                | PK (user_id, movie_id), elo_rating numeric(10,4) default 1000, comparison_count, updated_at                                                                                                                                                         |
| `movie_interest`                | PK (user_id, movie_id), interested bool — the "pass/skip" flag                                                                                                                                                                                      |
| `user_connections`              | id, requester_id, addressee_id, status (pending\|accepted\|rejected), CHECK no-self, UNIQUE pair                                                                                                                                                    |
| `tags`                          | id, slug (unique), label, value_type (boolean\|number\|text) — **shared across kinds**; seeds `seen`                                                                                                                                                |
| `movie_user_tags`               | id, movie_id, user_id, tag_id, value, UNIQUE (movie_id, user_id, tag_id)                                                                                                                                                                            |
| `password_reset_tokens`         | id, user_id, token_hash (unique), expires_at, used_at                                                                                                                                                                                               |
| `push_subscriptions`            | id, user_id, endpoint (unique), p256dh, auth, user_agent, failure_count, last_used_at — **p256dh/auth are secrets, never log**                                                                                                                      |
| `user_notification_preferences` | id, user_id, event_type, enabled, UNIQUE (user_id, event_type) — absent row means enabled                                                                                                                                                           |
| `kometa_schedule`               | **singleton, always `WHERE id = 1`**: enabled, frequency, daily_time, last_run_at, mdblist_api_key (+ 3 dead columns)                                                                                                                               |
| `kometa_mdblist_lists`          | list_type (combined\|solo), ref_id (polymorphic, no FK), list_name, mdblist_list_id/url, environment, kind — UNIQUE (list_type, ref_id, environment, kind)                                                                                          |
| `shows`                         | Mirrors movies minus rank/requester; adds first_air_year, created_by[], networks[], number_of_seasons, number_of_episodes, status; **next_season, next_episode, progress_updated_at** (manual household-shared episode progress, issue #107 / D-16) |
| `show_comparisons`              | Mirrors movie_comparisons against `shows`                                                                                                                                                                                                           |
| `user_show_elo`                 | PK (user_id, show_id)                                                                                                                                                                                                                               |
| `show_interest`                 | PK (user_id, show_id)                                                                                                                                                                                                                               |
| `show_user_tags`                | UNIQUE (show_id, user_id, tag_id), FK to shared `tags`                                                                                                                                                                                              |

The five `show*` tables now have a full GraphQL surface (Phase 2): the `show*` queries and mutations
above mirror their movie twins against these tables, with a strictly separate Elo pool. Frontend
(Phase 4) and Kometa/MDBList/Plex show export (Phase 5) are not built yet — shows are usable via the
API but have no UI and are not exported to Plex. See `specs/tv-shows.spec.md`.

Dropped along the way (do not resurrect): `movie_votes`, `user_movie_rankings`.

## Audit log actions

`MOVIE_ADD`, `MOVIE_WATCHED`, `MOVIE_UNWATCH`, `MOVIE_DELETE`, `MOVIE_TMDB_MATCH`,
`MOVIE_INTEREST_SET`, `MOVIE_TAG_SET`, `MOVIE_TAG_REMOVE`, `MOVIE_COMPARISON`,
`MOVIE_COMPARISON_RESET`, `MOVIE_SEED`, `CONNECTION_REQUEST`, `CONNECTION_ACCEPT`,
`CONNECTION_AUTO_ACCEPT`, `CONNECTION_REJECT`, `CONNECTION_REMOVE`, `LOGIN_SUCCESS`,
`PASSWORD_RESET_REQUEST`, `PASSWORD_RESET_SUCCESS`, `PASSWORD_RESET_FAILURE`, `USER_CREATE`,
`USER_UPDATE`, `USER_DELETE`, `KOMETA_EXPORT`, `KOMETA_SCHEDULE_EXPORT`, `MDBLIST_SYNC`,
`MDBLIST_AUTO_SYNC`, `LETTERBOXD_IMPORT`, `PUSH_SUBSCRIBE`, `PUSH_UNSUBSCRIBE`,
`NOTIFICATION_PREFS_UPDATE`, `SHOW_ADD`, `SHOW_WATCHED`, `SHOW_UNWATCH`, `SHOW_DELETE`,
`SHOW_TMDB_MATCH`, `SHOW_INTEREST_SET`, `SHOW_TAG_SET`, `SHOW_TAG_REMOVE`, `SHOW_COMPARISON`,
`SHOW_COMPARISON_RESET`, `SHOW_PROGRESS_SET`.

Failed logins are recorded in `login_history` (`succeeded = false`), **not** as an audit action.

## Key features

### Elo ranking ("This or That")

`thisOrThat` returns a pair chosen by a three-tier algorithm (`pairSelection.ts`: inverse-frequency
first pick, then seeded peer / Elo-proximity). `recordComparison` writes `movie_comparisons`, upserts
both `user_movie_elo` rows (K = 32, base 1000), and refreshes `movies.elo_rank` to the cross-user
average. Full design: `specs/this-or-that.spec.md`.

### Connections, interest and the combined list

Users connect pairwise (`user_connections`). `newMoviesFromConnections` surfaces a connection's
movies you haven't triaged; `setMovieInterest` records a thumbs-up/pass in `movie_interest`; passed
movies drop out of your queue. `combinedList(connectionId)` merges both users' Elo into a shared
ranking, flagging `bothRated`. `soloMovies` are movies no connection is interested in.

### Watched tracking ("Done")

`markWatched` sets `watched_at = NOW()`; the `movies` query returns only `watched_at IS NULL`.
`unwatchMovie` clears it. Both trigger a background MDBList re-sync so Plex reflects the change.

### Per-user tag system

`tags` (definitions, shared across kinds) + `movie_user_tags` (per-user instances). Boolean tags are
represented by row existence. Only `seen` ("Seen it") is seeded. Add a tag with
`INSERT INTO tags (slug, label, value_type) VALUES ('podcast-ep', 'Podcast Episode', 'number');` —
no migration or code change needed.

### TMDB integration

`backend/src/tmdb.ts` is a kind-dispatched adapter (`searchTmdb`, `fetchTmdbMetadata`,
`fetchAndStoreTmdbData`) handling both `/movie` and `/tv` endpoints, including the keywords quirk
(`.keywords` for movies, `.results` for TV). Metadata fetches are fire-and-forget after add/match.
`backfillTmdbData` retries rows where `tmdb_fetched_at IS NULL`.

> `importFromLetterboxd` bypasses this adapter and calls the TMDB search endpoint directly.

### MDBList → Kometa → Plex export

`runKometaExport` builds one MDBList list per accepted connection (`Alice & Bob`) and per user
(`Just Alice`), prefixed `[DEV] ` outside production, syncs the tmdb_ids to MDBList, writes
`movienight.yml` for Kometa, then reconciles Plex by **deleting any collection carrying the
`MovieNight` label that isn't in the current run**. Lists are persisted in `kometa_mdblist_lists`.
`scheduler.ts` runs this hourly/daily in production only.

### Web Push

VAPID-based, opt-out per event type. `NOTIFICATION_EVENT_TYPES` in `resolvers.ts` is the whitelist —
`MOVIE_ADD` and `SHOW_ADD`, each fired to the requester's accepted connections when a movie/show is
added. Adding an event type needs no migration. Full design: `specs/push-notifications.spec.md`.

### Password reset

`requestPasswordReset` always reports success (no account enumeration), stores a hashed token, and
emails a link via `email.ts`. Requires SMTP config; otherwise it silently no-ops.

## Environment variables

**Frontend** (`.env`): `REACT_APP_GRAPHQL_URL` (defaults `/graphql`), `REACT_APP_GIT_BRANCH`,
`REACT_APP_GIT_HASH`, `REACT_APP_DEPLOY_TIME` (baked in at Docker build time).

**Backend**:

| Var                                                        | Purpose                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`              | Postgres connection                                                                                                                                                                         |
| `PORT`                                                     | default 4000                                                                                                                                                                                |
| `JWT_SECRET`                                               | **change in production**                                                                                                                                                                    |
| `ADMIN_PASSWORD`                                           | seeds the `admin` user (default `admin123`)                                                                                                                                                 |
| `TEST_USER_USERNAME` / `TEST_USER_PASSWORD`                | seeds a test user when `NODE_ENV != production`                                                                                                                                             |
| `NODE_ENV`                                                 | `production` enables Kometa file export + scheduler                                                                                                                                         |
| `CORS_ORIGIN`                                              | defaults `http://localhost:3000`                                                                                                                                                            |
| `TMDB_API_KEY`                                             | enables TMDB search + metadata                                                                                                                                                              |
| `MDBLIST_API_KEY`                                          | fallback if no key is stored in `kometa_schedule`                                                                                                                                           |
| `KOMETA_COLLECTIONS_PATH` / `KOMETA_TRIGGER_URL`           | YAML output dir; optional post-export webhook                                                                                                                                               |
| `PLEX_URL` / `PLEX_TOKEN` / `PLEX_MOVIES_SECTION_ID`       | Plex reconciler; skipped silently if URL or token is unset                                                                                                                                  |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`, `APP_URL`          | password-reset email                                                                                                                                                                        |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push. **Not in `.env.example` or `docker-compose.yml`** — push is disabled until they're set (the backend logs "VAPID keys not set"). Generate with `npx web-push generate-vapid-keys`. |

## Docker profiles

| Profile       | Services                                                                          |
| ------------- | --------------------------------------------------------------------------------- |
| `development` | db (postgres:15-alpine), backend, frontend (hot-reload)                           |
| `production`  | Single `movienight` container (ghcr.io image, port 8080→80, 1 CPU / 512 MB limit) |

**Production image**: multi-stage — node:20-alpine builds React, nginx:alpine serves static files and
proxies `/graphql` to `movienight-backend:4000`.

## CI/CD

| Workflow          | Trigger                                       | What it does                                                                           |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ci.yml`          | push to any branch                            | Lint & format check (`prettier --check .`, `eslint src/`), backend + frontend tests    |
| `test-build.yml`  | push to `dev`                                 | Tests, then Docker build (no push), `dorny/paths-filter` to skip unchanged layers      |
| `deploy-test.yml` | PR opened/synced/ready (non-draft, same-repo) | Builds `:test` images, deploys to **movienight-test** on the self-hosted `nova` runner |
| `deploy.yml`      | push to `master`, manual dispatch             | Builds and pushes to GHCR, deploys to nova                                             |

Both deploy workflows run on the **self-hosted `[self-hosted, nova, movienight-*]` runner**, whose
Docker socket proxy denies `/auth` — so they write GHCR credentials into `~/.docker/config.json`
rather than running `docker login`. Test environment: `movienight-test.<NOVA_DOMAIN>`, compose file
at `movienight-test/compose.yaml` in nova-config.

CodeQL also runs on PRs. Note `master` is **not** branch-protected — no check is strictly required
to merge.

## Testing

```bash
cd backend && npm test                    # 361 tests, 21 suites
cd backend && npm test -- --coverage
npm test -- --watchAll=false              # frontend
```

Backend suites live in `backend/src/__tests__/` (`auth`, `elo`, `pairSelection`, `scheduler`,
`email`, `push`, `tmdb`, `contentActions`, `mdblist`, `kometaExport`, `plexClient`, plus
`resolvers/` split by domain). Frontend tests cover `src/utils/` and `src/contexts/` only.

**Coverage thresholds** (`backend/jest.config.ts`, enforced in CI): 80% statements / lines /
functions, 65% branches. No frontend threshold.

### Requirements for new code

- All new backend functions must have companion tests.
- New resolvers must test happy path, auth/authz, and at least two error/edge cases.
- `pool.query` must always use parameterised queries.
- Run `cd backend && npm test` and `npm test -- --watchAll=false` after changes.
- Prettier is enforced by a Husky pre-commit hook and by CI. Run `npx prettier --write <files>`.
  Never skip hooks (`--no-verify`) without explicit approval.

## Gotchas

Things that look like bugs, or that stale docs have claimed before:

1. **`movies.rank` is dead but `NOT NULL`.** Ordering has used Elo since migration
   `1745600000000`. The column is still written (`VALUES ($1, $2, 0, $3)`) and recomputed on unwatch,
   is never exposed in GraphQL, and never read for ordering. Any `INSERT INTO movies` must still
   supply it.
2. **`@dnd-kit/*` is in `package.json` but imported nowhere.** Left over from drag-to-rank. There is
   no drag-and-drop in the app.
3. **`markWatched` and `unwatchMovie` have deliberately different auth gates** — the former accepts
   an accepted-connection of the owner, the latter is owner-or-admin. Don't "fix" one in passing.
4. **`KometaSchedule.exportedLists` reports `movieCount: 0`** — the count is still hardcoded (now in
   the shared `fetchExportedLists` helper), never a real count.
5. **`kometa_schedule` is a singleton** — every query hardcodes `WHERE id = 1`.
6. **`kometa_mdblist_lists` reads are now `kind`-scoped** (H-6 fixed): `fetchExportedLists` in
   `resolvers.ts` filters `WHERE environment = $1 AND kind = $2`, defaulting to `'movie'`. Phase 5
   threads `kind` through the export and can widen this to surface show lists too.
7. **Dead columns**: `kometa_schedule.collection_name`, `.mdblist_list_id`, `.mdblist_list_url`.
8. **Unused imports in `resolvers.ts`**: `fs`, `path`, `createList`, `syncList`.
9. **Timestamp types are inconsistent** — tables predating `1742860000000` use `timestamp` without
   time zone; newer ones use `timestamptz`. `shows.date_submitted` follows the old style to match
   `movies`.
10. **`setMdblistApiKey` writes no audit entry**, unlike every other admin config mutation.

## Existing docs

- `README.md` — quick-start and API examples
- `AUTHENTICATION.md` — JWT flow, default credentials, user management
- `DEPLOYMENT.md` — CI/CD setup, SSH keys, GHCR config
- `backend/MIGRATIONS.md` — migration conventions
- `specs/tv-shows.spec.md` — TV shows feature, phases 1–5
- `specs/this-or-that.spec.md` — Elo ranking design
- `specs/push-notifications.spec.md` — Web Push design
