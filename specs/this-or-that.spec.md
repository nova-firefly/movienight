# Feature: This or That — Pairwise Movie Ranking

## Overview

A dedicated screen presenting two randomly selected unwatched movies side-by-side. The user picks which they'd rather watch. Each pick is recorded as a pairwise comparison; an Elo rating system derives a per-user preference ranking from the accumulated results. A global Elo average is cached on `movies.elo_rank` and is available as a secondary sort signal.

### Relationship to existing ranking system

The app already has a ranking system:
- **Drag-to-rank** → `user_movie_rankings` (per-user fractional index) → Borda count → `movies.rank` (global aggregate, recomputed on a debounced 10-second schedule and every 5 minutes)
- **Unauthenticated** homepage: sorted by `movies.rank DESC` (Borda consensus)
- **Authenticated** homepage: sorted by user's personal `user_movie_rankings.rank ASC NULLS LAST`

"This or That" adds a **parallel signal**:
- **Pairwise comparison** → `movie_comparisons` (log) + `user_movie_elo` (per-user Elo) → `movies.elo_rank` (global Elo average)

Both signals coexist. The homepage sort is unchanged. The Elo ranking is surfaced on the This or That screen in a "My Rankings" tab.

---

## Ranking Algorithm: Elo

Chosen because it is optimal for pairwise comparison data: each head-to-head pick carries directional information about relative preference that Elo converts into a continuous score, whereas Borda requires an explicit full ordering first.

**Parameters:** starting rating = 1000, K-factor = 32

```
Expected score:  E_A = 1 / (1 + 10 ^ ((R_B − R_A) / 400))
Winner update:   R_A' = R_A + 32 × (1 − E_A)
Loser update:    R_B' = R_B + 32 × (0 − (1 − E_A))
```

**Global Elo (`movies.elo_rank`)** = arithmetic average of all users' Elo ratings for that movie, recomputed after every comparison and every reset. Null when no comparisons have been recorded.

---

## Functional Requirements

### FR-TOT-001: Navigation
While logged in, when the user clicks "This or That" in the nav, the system shall display the comparison screen.

### FR-TOT-002: Pair selection
When a pair is needed, the system shall select two distinct unwatched movies at random, attempting to exclude the IDs passed in `excludeIds`. If fewer than 2 movies remain after exclusion the exclusion filter shall be ignored. If fewer than 2 unwatched movies exist at all, the system shall return an error.

### FR-TOT-003: Movie card content
For each movie in a pair, the system shall display:
- Poster image (TMDB `w342` image URL if `tmdb_id` is set, else a placeholder)
- Title
- Release year (TMDB)
- Director (first TMDB crew member with `job === 'Director'`)
- Top 3 billed cast members (TMDB `cast` array)
- Up to 5 tags: TMDB genre names first, padded with TMDB keyword names if fewer than 5 genres
- For movies without a `tmdb_id`: title only with a "No TMDB match" indicator; no crash

### FR-TOT-004: TMDB fetch and cache
When enriching a movie card, the system shall call three TMDB endpoints in parallel (`/movie/{id}`, `/movie/{id}/credits`, `/movie/{id}/keywords`) and cache the result in an in-memory Map keyed by `tmdb_id` with a 24-hour TTL. On cache hit the TMDB API shall not be called.

### FR-TOT-005: Record comparison
When the user picks a movie, the system shall:
1. Insert a row into `movie_comparisons` (winner_id, loser_id, user_id)
2. Upsert Elo ratings in `user_movie_elo` for both movies using the Elo formula
3. Update `movies.elo_rank` for both movies to the current `AVG(elo_rating)` across all users
4. Return the new Elo values in `ComparisonResult`

### FR-TOT-006: Avoid immediate repeat pair
The system shall accept an `excludeIds: [ID!]` argument on `thisOrThat` and exclude those movie IDs from selection where possible (see FR-TOT-002). The client sends the IDs of both movies from the previous pair.

### FR-TOT-007: Session counter
While the comparison screen is active, the system shall display a running count of comparisons completed in the current session.

### FR-TOT-008: Personal Elo rankings
When the user views the "My Rankings" tab, the system shall return all unwatched movies where the user has at least one comparison, sorted by their personal Elo rating descending, including the Elo score and comparison count.

### FR-TOT-009: Reset a movie
When the user resets a movie, the system shall:
1. Delete all `movie_comparisons` rows for that user involving that movie (as winner or loser)
2. Delete the `user_movie_elo` row for that user + movie
3. Recompute `movies.elo_rank` for the affected movie (becomes NULL if no other users have data)

### FR-TOT-010: Minimum pool guard
When fewer than 2 unwatched movies exist, the system shall return a `BAD_USER_INPUT` error and the frontend shall display "Add more movies to start comparing."

### FR-TOT-011: Auth guard
All `thisOrThat`, `myRankings`, `recordComparison`, and `resetMovieComparisons` operations shall require authentication and return `UNAUTHENTICATED` otherwise.

---

## Non-Functional Requirements

- **TMDB fetch latency**: pair query including parallel TMDB fetches < 2 s p95 (cache should reduce this to < 100 ms on repeat)
- **Comparison write**: `recordComparison` mutation < 200 ms p95 (all local DB)
- **Security**: `userId` is always read from `context.user.userId` (JWT); client cannot submit a different user's comparison
- **Reset authorization**: `resetMovieComparisons` only deletes rows where `user_id = context.user.userId`
- **TMDB API key**: never exposed to the client; all TMDB calls are server-side only
- **Mobile**: cards stack vertically at < 600 px viewport width; equal tap target heights

---

## Acceptance Criteria

### AC-001: Happy-path comparison
```
Given a logged-in user on the comparison screen with ≥ 2 unwatched movies
When they tap a movie card
Then that movie's Elo for the user increases and the other decreases
And movies.elo_rank for both movies is updated to the new global average
And a new pair is immediately shown
And the session counter increments by 1
```

### AC-002: Rich metadata displayed
```
Given a movie with a valid tmdb_id
When it appears in a pair
Then its poster, year, director, ≤3 cast names, and ≤5 tags are shown
```

### AC-003: Unmatched movie fallback
```
Given a movie with no tmdb_id
When it appears in a pair
Then only the title and "No TMDB match" indicator are shown
And no layout breaks occur
```

### AC-004: Immediate-repeat pair avoided
```
Given the user just compared Movie A vs Movie B
When the next pair is requested (excludeIds = [A, B])
Then the returned pair does not include Movie A or Movie B
  (unless fewer than 2 other movies exist)
```

### AC-005: Reset
```
Given a user has made 8 comparisons involving Movie X
When they click Reset on Movie X and confirm
Then all their movie_comparisons rows for Movie X are deleted
And their user_movie_elo row for Movie X is deleted
And movies.elo_rank for Movie X is recomputed (NULL if no other users had data)
And Movie X disappears from their My Rankings tab
```

### AC-006: Minimum pool guard
```
Given only 1 unwatched movie exists
When the user is on the comparison screen
Then "Add more movies to start comparing" is displayed
And no movie cards are rendered
```

### AC-007: My Rankings ordering
```
Given a user has compared several movies
When they view "My Rankings"
Then movies are listed in descending Elo order
And each row shows the Elo score and number of comparisons
```

### AC-008: Unauthenticated access
```
Given an unauthenticated visitor
When they navigate to the This or That screen
Then they are redirected to the login page
```

---

## Error Handling

| Condition | Server response | User-visible message |
|---|---|---|
| TMDB_API_KEY missing | Return movie without TMDB fields | "Movie details unavailable" |
| TMDB API error / timeout | Log server-side; return null fields | "Movie details unavailable" |
| < 2 unwatched movies | `BAD_USER_INPUT` | "Add more movies to start comparing" |
| Unauthenticated | `UNAUTHENTICATED` | Redirect to login |
| Movie not found on reset | `NOT_FOUND` | "Movie not found" |

---

## Database Schema

Latest existing migration: `1745500001000_drop-movie-votes.js`

### New migration: `1745600000000_add-elo-ranking.js`

```js
exports.up = (pgm) => {
  // Global Elo average cache on movies
  pgm.addColumn('movies', {
    elo_rank: { type: 'numeric(10,4)', notNull: false },
  });

  // Append-only log of every pairwise pick
  pgm.createTable('movie_comparisons', {
    id:         { type: 'serial', primaryKey: true },
    user_id:    { type: 'integer', notNull: true, references: '"users"',  onDelete: 'CASCADE' },
    winner_id:  { type: 'integer', notNull: true, references: '"movies"', onDelete: 'CASCADE' },
    loser_id:   { type: 'integer', notNull: true, references: '"movies"', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('movie_comparisons', 'user_id');
  pgm.createIndex('movie_comparisons', 'winner_id');
  pgm.createIndex('movie_comparisons', 'loser_id');

  // Per-user, per-movie Elo rating
  pgm.createTable('user_movie_elo', {
    user_id:          { type: 'integer', notNull: true, references: '"users"',  onDelete: 'CASCADE' },
    movie_id:         { type: 'integer', notNull: true, references: '"movies"', onDelete: 'CASCADE' },
    elo_rating:       { type: 'numeric(10,4)', notNull: true, default: 1000 },
    comparison_count: { type: 'integer', notNull: true, default: 0 },
    updated_at:       { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('user_movie_elo', 'user_movie_elo_pkey', 'PRIMARY KEY (user_id, movie_id)');
};

exports.down = (pgm) => {
  pgm.dropTable('user_movie_elo');
  pgm.dropTable('movie_comparisons');
  pgm.dropColumn('movies', 'elo_rank');
};
```

### Updated DB overview (ranking tables only)

| Table | Purpose |
|---|---|
| `user_movie_rankings` | Per-user drag-to-rank fractional index (feeds Borda) |
| `movie_comparisons` | Append-only log of This-or-That picks |
| `user_movie_elo` | Per-user Elo rating per movie (PK: user_id, movie_id) |
| `movies.rank` | Borda count cache (written by `recalculateBordaRanks`) — **unchanged** |
| `movies.elo_rank` | Global Elo average cache (written after each comparison/reset) — **new** |

---

## GraphQL Additions

### New types

```graphql
type ThisOrThatMovie {
  id: ID!
  title: String!
  tmdb_id: Int
  poster_url: String
  release_year: String
  director: String
  cast: [String!]!
  tags: [String!]!
}

type ThisOrThatPair {
  movieA: ThisOrThatMovie!
  movieB: ThisOrThatMovie!
}

type ComparisonResult {
  winnerId: ID!
  loserId: ID!
  winnerElo: Float!
  loserElo: Float!
}

type MovieRanking {
  movie: Movie!
  eloRating: Float!
  comparisonCount: Int!
}
```

### New queries

```graphql
thisOrThat(excludeIds: [ID!]): ThisOrThatPair!   # requires auth
myRankings: [MovieRanking!]!                      # requires auth
```

### New mutations

```graphql
recordComparison(winnerId: ID!, loserId: ID!): ComparisonResult!  # requires auth
resetMovieComparisons(movieId: ID!): Boolean!                     # requires auth, own data only
```

---

## Backend Implementation Notes

### `backend/src/elo.ts` (new file)

```typescript
import pool from './db';

export function calculateElo(rA: number, rB: number, k = 32): { newA: number; newB: number } {
  const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  return { newA: rA + k * (1 - eA), newB: rB + k * (0 - (1 - eA)) };
}

// ON CONFLICT DO UPDATE SET user_id = EXCLUDED.user_id is a no-op that still
// returns the existing row via RETURNING — avoids a two-query select + insert.
export async function getOrCreateElo(userId: number, movieId: number): Promise<number> {
  const res = await pool.query(
    `INSERT INTO user_movie_elo (user_id, movie_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, movie_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING elo_rating`,
    [userId, movieId]
  );
  return Number(res.rows[0].elo_rating);
}

export async function applyComparison(
  userId: number, winnerId: number, loserId: number
): Promise<{ winnerElo: number; loserElo: number }> {
  const [rWinner, rLoser] = await Promise.all([
    getOrCreateElo(userId, winnerId),
    getOrCreateElo(userId, loserId),
  ]);
  const { newA, newB } = calculateElo(rWinner, rLoser);

  await pool.query(
    `UPDATE user_movie_elo
     SET elo_rating = $1, comparison_count = comparison_count + 1, updated_at = NOW()
     WHERE user_id = $2 AND movie_id = $3`,
    [newA, userId, winnerId]
  );
  await pool.query(
    `UPDATE user_movie_elo
     SET elo_rating = $1, comparison_count = comparison_count + 1, updated_at = NOW()
     WHERE user_id = $2 AND movie_id = $3`,
    [newB, userId, loserId]
  );
  await pool.query(
    'INSERT INTO movie_comparisons (user_id, winner_id, loser_id) VALUES ($1, $2, $3)',
    [userId, winnerId, loserId]
  );

  // Recompute global elo_rank for both movies.
  // AVG returns NULL when no rows match — which correctly nullifies elo_rank after a reset.
  for (const mid of [winnerId, loserId]) {
    await pool.query(
      `UPDATE movies SET elo_rank = (
         SELECT AVG(elo_rating) FROM user_movie_elo WHERE movie_id = $1
       ) WHERE id = $1`,
      [mid]
    );
  }

  return { winnerElo: newA, loserElo: newB };
}
```

### TMDB enrichment cache (top of `resolvers.ts`)

```typescript
const tmdbEnrichCache = new Map<number, { data: TmdbEnriched; expiresAt: number }>();
const TMDB_TTL = 24 * 60 * 60 * 1000;

interface TmdbEnriched {
  poster_url: string | null;
  release_year: string | null;
  director: string | null;
  cast: string[];
  tags: string[];
}

async function enrichWithTmdb(movie: { id: number; title: string; tmdb_id: number | null }) {
  if (!movie.tmdb_id) return { id: String(movie.id), title: movie.title, tmdb_id: null,
    poster_url: null, release_year: null, director: null, cast: [], tags: [] };

  const cached = tmdbEnrichCache.get(movie.tmdb_id);
  if (cached && cached.expiresAt > Date.now()) {
    return { id: String(movie.id), title: movie.title, tmdb_id: movie.tmdb_id, ...cached.data };
  }

  const apiKey = process.env.TMDB_API_KEY;
  const empty = { id: String(movie.id), title: movie.title, tmdb_id: movie.tmdb_id,
    poster_url: null, release_year: null, director: null, cast: [], tags: [] };
  if (!apiKey) return empty;

  try {
    const base = `https://api.themoviedb.org/3/movie/${movie.tmdb_id}`;
    const [det, cred, kw] = await Promise.all([
      fetch(`${base}?api_key=${apiKey}&language=en-US`).then((r) => r.json()),
      fetch(`${base}/credits?api_key=${apiKey}`).then((r) => r.json()),
      fetch(`${base}/keywords?api_key=${apiKey}`).then((r) => r.json()),
    ]);
    const data: TmdbEnriched = {
      poster_url: det.poster_path ? `https://image.tmdb.org/t/p/w342${det.poster_path}` : null,
      release_year: det.release_date ? det.release_date.split('-')[0] : null,
      director: (cred.crew ?? []).find((c: any) => c.job === 'Director')?.name ?? null,
      cast: (cred.cast ?? []).slice(0, 3).map((c: any) => c.name),
      tags: [...(det.genres ?? []).map((g: any) => g.name),
             ...(kw.keywords ?? []).map((k: any) => k.name)].slice(0, 5),
    };
    tmdbEnrichCache.set(movie.tmdb_id, { data, expiresAt: Date.now() + TMDB_TTL });
    return { id: String(movie.id), title: movie.title, tmdb_id: movie.tmdb_id, ...data };
  } catch {
    return empty;
  }
}
```

### `thisOrThat` resolver

```typescript
// Attempt to exclude seen IDs; fall back to full pool if < 2 remain
async function pickPair(excludeIds: number[]) {
  if (excludeIds.length > 0) {
    const res = await pool.query(
      `SELECT id, title, tmdb_id FROM movies
       WHERE watched_at IS NULL AND id != ALL($1::int[])
       ORDER BY RANDOM() LIMIT 2`,
      [excludeIds]
    );
    if (res.rows.length >= 2) return res.rows;
  }
  const res = await pool.query(
    `SELECT id, title, tmdb_id FROM movies
     WHERE watched_at IS NULL ORDER BY RANDOM() LIMIT 2`
  );
  return res.rows;
}
```

### `myRankings` resolver — note on Movie shape

The `Movie` type no longer has a `votes` field (removed in the rebase). The query for `myRankings` can return a plain movie row without any stub fields:

```sql
SELECT m.id, m.title, m.requested_by, m.date_submitted, m.rank, m.tmdb_id, m.watched_at,
       u.username AS user_username, u.display_name AS user_display_name,
       ume.elo_rating, ume.comparison_count
FROM user_movie_elo ume
JOIN movies m ON ume.movie_id = m.id
LEFT JOIN users u ON m.requested_by = u.id
WHERE ume.user_id = $1 AND m.watched_at IS NULL
ORDER BY ume.elo_rating DESC
```

The existing `Movie.requester` and `Movie.date_submitted` field resolvers handle the `user_username` / `user_display_name` columns already.

### Audit log action names to add

`MOVIE_COMPARISON`, `MOVIE_COMPARISON_RESET`

---

## Frontend Implementation Notes

### New files

| File | Purpose |
|---|---|
| `src/components/home/MovieCompareCard.tsx` | Single movie card: poster, title, year, director, cast, tags, full-card click |
| `src/components/home/ThisOrThat.tsx` | Comparison screen (Compare tab + My Rankings tab) |

### Changed files

| File | Change |
|---|---|
| `src/graphql/queries.ts` | Add `THIS_OR_THAT`, `MY_RANKINGS`, `RECORD_COMPARISON`, `RESET_MOVIE_COMPARISONS` |
| `src/App.tsx` | `showUserManagement: boolean` → `currentView: 'movies' \| 'this-or-that' \| 'admin'` |
| `src/components/common/Navbar.tsx` | Replace `showUserManagement: boolean` prop with `currentView`; add "This or That" button |

### `App.tsx` routing change

```typescript
type ViewName = 'movies' | 'this-or-that' | 'admin';
const [currentView, setCurrentView] = React.useState<ViewName>('movies');
```

The existing `main` box wrapper (with `px`, `py`, `maxWidth`) is reused — `ThisOrThat` replaces `AdminPanel` in the conditional when `currentView === 'this-or-that'`.

### `Navbar.tsx` change

Replace `showUserManagement: boolean` prop with `currentView: ViewName` and `onShowThisOrThat: () => void`. Add "This or That" button visible to all authenticated users, placed between Movies and Admin. Active state: `currentView === 'this-or-that'`.

### `ThisOrThat.tsx` key behaviour

- `useLazyQuery(THIS_OR_THAT, { fetchPolicy: 'network-only' })` fetched on mount and after each pick
- `seenIds: string[]` state collects all movie IDs shown this session; sent as `excludeIds` to avoid re-showing the same pair
- `recordComparison` refetches `GET_MOVIES` so the Borda-sorted list updates if visible
- Rankings tab uses `useQuery(MY_RANKINGS, { skip: tab !== 'rankings' })` to avoid a query on load
- Empty state triggered when error has `extensions.code === 'BAD_USER_INPUT'`
- Cards displayed side-by-side (flex row) on ≥ sm breakpoint, stacked on xs

---

## Implementation TODO

### Backend
- [ ] Create migration `1745600000000_add-elo-ranking.js`
- [ ] Create `backend/src/elo.ts` with `calculateElo`, `getOrCreateElo`, `applyComparison`
- [ ] Add `ThisOrThatMovie`, `ThisOrThatPair`, `ComparisonResult`, `MovieRanking` types to `schema.ts`
- [ ] Add `thisOrThat` / `myRankings` queries to `schema.ts`
- [ ] Add `recordComparison` / `resetMovieComparisons` mutations to `schema.ts`
- [ ] Add `tmdbEnrichCache` + `enrichWithTmdb` helper to `resolvers.ts`
- [ ] Implement `thisOrThat` resolver (random pair selection + parallel TMDB enrichment)
- [ ] Implement `myRankings` resolver (JOIN user_movie_elo → movies, order by elo_rating DESC)
- [ ] Implement `recordComparison` resolver (auth check → `applyComparison` → audit log)
- [ ] Implement `resetMovieComparisons` resolver (delete rows → recompute elo_rank → audit log)

### Frontend
- [ ] Add `THIS_OR_THAT`, `MY_RANKINGS`, `RECORD_COMPARISON`, `RESET_MOVIE_COMPARISONS` to `queries.ts`
- [ ] Create `MovieCompareCard.tsx`
- [ ] Create `ThisOrThat.tsx`
- [ ] Update `App.tsx`: `showUserManagement: boolean` → `currentView: ViewName`
- [ ] Update `Navbar.tsx`: add `currentView` prop + "This or That" button
