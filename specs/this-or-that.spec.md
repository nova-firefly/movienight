# Feature: This or That — Pairwise Movie Ranking

## Overview

A dedicated screen presenting two randomly selected unwatched movies side-by-side. The user picks which they'd rather watch. Each pick is recorded as a pairwise comparison; an Elo rating system derives a per-user preference ranking and a global consensus ranking from the accumulated results.

**This replaces drag-to-rank as the sole ranking mechanism.** The `user_movie_rankings` table, `reorderMyMovie` mutation, and the Borda count scheduler are removed. Elo is the single source of truth for movie ordering.

### Why one system, not two

Drag-to-rank (Borda count) and pairwise Elo both answer "which movie should we watch?" through different UX patterns. Keeping both creates two competing signals with no defined winner and doubles the ranking infrastructure. The choice between them reduces to one question: _do you want a ranking you deliberately set in one session, or one that emerges from casual use over time?_

Pairwise comparison wins here because:
- Adding a new movie to a drag list requires consciously re-evaluating its position against every other film — a mental effort most users skip, leaving new movies perpetually unranked
- Pairwise picks happen naturally and remain accurate as the list grows
- A single source of truth makes the homepage unambiguous

The only capability lost is explicit top-of-list placement. This is acceptable given the low user count.

### Ranking signals after this change

| Signal | Table | Global cache | Sort |
|---|---|---|---|
| Pairwise Elo | `user_movie_elo` | `movies.elo_rank` | Homepage: `elo_rank DESC NULLS LAST` |
| ~~Drag-to-rank~~ | ~~`user_movie_rankings`~~ | ~~`movies.rank` (Borda)~~ | ~~removed~~ |

`movies.rank` becomes an unused column (left in place to avoid a destructive migration; can be dropped in a future cleanup migration).

---

## Ranking Algorithm: Elo

**Parameters:** starting rating = 1000, K-factor = 32

```
Expected score:  E_A = 1 / (1 + 10 ^ ((R_B − R_A) / 400))
Winner update:   R_A' = R_A + 32 × (1 − E_A)
Loser update:    R_B' = R_B + 32 × (0 − (1 − E_A))
```

**Per-user Elo** stored in `user_movie_elo(user_id, movie_id, elo_rating, comparison_count)`.

**Global Elo (`movies.elo_rank`)** = arithmetic average of all users' current Elo ratings for that movie. Recomputed after every comparison and every reset. Null when no comparisons have been recorded.

**Homepage sort:**
- Authenticated users: ordered by their own `user_movie_elo.elo_rating DESC NULLS LAST, date_submitted ASC`
- Unauthenticated users: ordered by `movies.elo_rank DESC NULLS LAST, date_submitted ASC`

---

## Pair Selection Algorithm

Random pair selection is naïve and has two failure modes for this use case: newly added movies may go many sessions without appearing (poor placement speed), and established movies may be over- or under-compared (fairness drift). The algorithm below addresses both.

### Three-tier selection

**Constants:**
- `K = 5` — comparison threshold between "new" and "established" for the current user
- `EP_POOL = max(5, floor(totalMovies × 0.1))` — candidate pool size for Elo-proximity matching

#### Tier 1 — Select the first movie (IFW)

Weight each unwatched movie by inverse comparison frequency:

```
weight(movie) = 1 / (user_comparison_count + 1)
```

A new movie (count = 0) has weight 1.0; a movie with 10 comparisons has weight 0.09. Sample the first movie proportionally to these weights. This is self-correcting: over-compared movies naturally get fewer appearances; under-compared movies surface more often.

#### Tier 2 — Select the second movie: seeded mode (first movie has count < K)

New movies must be anchored against movies with established ratings, not against other new movies (pairing two 1000-rated movies produces no useful signal). Pick the second movie from the established pool (count ≥ K) using a two-band approach:
- One candidate from within 150 Elo of the established median (a "peer" comparison)
- One candidate sampled uniformly from the full established range (a "ranging" comparison)
- Choose randomly between the two

If fewer than K established movies exist (early list, or all new), fall back to IFW for the second pick (pick any different movie by inverse weight).

#### Tier 3 — Select the second movie: normal mode (first movie has count ≥ K)

Pick from the `EP_POOL` nearest movies by Elo distance and sample randomly among them. Strict nearest-1 is avoided because with small pools it locks the same pair in a loop — two movies that are always each other's closest neighbor compare repeatedly while the rest of the pool is ignored.

```
candidates = movies sorted by |elo_rating - first_movie_elo| ASC, limit EP_POOL
second_movie = random pick from candidates
```

### Why this works for the specific constraints

| Problem | Mechanism that solves it |
|---|---|
| New movie added: doesn't appear for many sessions | IFW weight = 1.0 on first pick; highest possible priority |
| New movie added: compared against other new movies | Seeded mode forces anchor against established pool |
| Multiple new movies added at once | All share IFW priority equally; seeding ensures each anchors correctly |
| Same pair appears repeatedly | EP_POOL randomisation breaks nearest-neighbour lock |
| Established movies drift apart in comparison count | IFW decay brings lagging movies back up naturally |
| Pool has < 2 movies | Caught by minimum pool guard (FR-TOT-010) before algorithm runs |

### Algorithm summary (pseudocode)

```
function selectPair(userId, excludeIds):
  movies = fetchUnwatched(excludeIds)
  if movies.length < 2: throw NOT_ENOUGH_MOVIES

  // Tier 1: IFW first pick
  weights = movies.map(m => 1 / (m.userComparisonCount + 1))
  first = weightedRandom(movies, weights)

  established = movies.filter(m => m.id != first.id && m.userComparisonCount >= K)

  if first.userComparisonCount < K:
    // Tier 2: seeded second pick
    if established.length >= K:
      median = medianElo(established)
      peers = established.filter(m => |m.elo - median| <= 150)
      rangers = established
      second = random() < 0.5 ? randomFrom(peers || established) : randomFrom(rangers)
    else:
      second = weightedRandom(movies excluding first, weights excluding first)
  else:
    // Tier 3: Elo-proximity second pick
    epPool = established.sortBy(m => |m.elo - first.elo|).slice(0, EP_POOL)
    second = randomFrom(epPool)

  return { first, second }
```

---

## Functional Requirements

### FR-TOT-001: Navigation
While logged in, when the user clicks "This or That" in the nav, the system shall display the comparison screen.

### FR-TOT-002: Pair selection
When a pair is needed, the system shall select two distinct unwatched movies using the three-tier algorithm described above, excluding IDs in `excludeIds` where possible. If fewer than 2 unwatched movies remain after exclusion, the exclusion filter shall be ignored. If fewer than 2 unwatched movies exist at all, the system shall return a `BAD_USER_INPUT` error.

### FR-TOT-003: Movie card content
For each movie in a pair, the system shall display:
- Poster image (TMDB `w342` URL if `tmdb_id` is set, else a placeholder)
- Title
- Release year (from TMDB)
- Director (first crew member where `job === 'Director'`)
- Top 3 billed cast members
- Up to 5 tags: TMDB genre names first, padded with TMDB keyword names
- Movies without a `tmdb_id`: title only with a "No TMDB match" note; no layout break

### FR-TOT-004: TMDB fetch and cache
When enriching a movie card, the system shall call three TMDB endpoints in parallel (`/movie/{id}`, `/movie/{id}/credits`, `/movie/{id}/keywords`) and cache the result in an in-memory Map keyed by `tmdb_id` with a 24-hour TTL. On cache hit the TMDB API shall not be called.

### FR-TOT-005: Record comparison
When the user picks a movie, the system shall:
1. Insert a row into `movie_comparisons` (winner_id, loser_id, user_id)
2. Upsert Elo ratings in `user_movie_elo` for both movies using the Elo formula
3. Update `movies.elo_rank` for both movies to `AVG(elo_rating)` across all users
4. Return the new Elo values in `ComparisonResult`

### FR-TOT-006: Exclude recent pair
The system shall accept `excludeIds: [ID!]` and apply the exclusion before pair selection. The client sends both IDs from the previous pair to avoid an immediate repeat.

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

### FR-TOT-011: Homepage sort order
The `movies` query resolver shall be updated to sort by Elo instead of Borda:
- Authenticated: `ORDER BY ume.elo_rating DESC NULLS LAST, m.date_submitted ASC` (join user_movie_elo for current user)
- Unauthenticated: `ORDER BY m.elo_rank DESC NULLS LAST, m.date_submitted ASC`

### FR-TOT-012: Auth guard
All `thisOrThat`, `myRankings`, `recordComparison`, and `resetMovieComparisons` operations shall require authentication and return `UNAUTHENTICATED` otherwise.

### FR-TOT-013: Remove drag-to-rank
The `reorderMyMovie` mutation, `user_movie_rankings` table, and Borda count recalculation (`recalculateBordaRanks`, `scheduleBordaRecalculation`, periodic interval) shall be removed. The drag-and-drop UI in `Homepage.tsx` shall be removed.

---

## Non-Functional Requirements

- **Pair query latency** (including TMDB parallel fetches): < 2 s p95; < 100 ms on cache hit
- **Comparison write**: `recordComparison` < 200 ms p95 (all local DB)
- **Security**: `userId` always from `context.user.userId` (JWT); client cannot inject a different user
- **Reset authorization**: only deletes rows where `user_id = context.user.userId`
- **TMDB API key**: server-side only, never sent to client
- **Mobile**: cards stack vertically at xs breakpoint with equal tap target heights

---

## Acceptance Criteria

### AC-001: Happy-path comparison
```
Given a logged-in user on the comparison screen with ≥ 2 unwatched movies
When they tap a movie card
Then that movie's Elo for the user increases and the other decreases
And movies.elo_rank for both movies is updated
And a new pair is immediately shown
And the session counter increments by 1
```

### AC-002: New movie gets fast placement
```
Given a movie was just added (0 comparisons for the current user)
When the user starts a This or That session
Then the new movie appears in one of the first 3 pairs presented
And its opponent has at least K=5 comparisons (is established)
```

### AC-003: Immediate-repeat pair avoided
```
Given the user just compared Movie A vs Movie B
When the next pair is requested with excludeIds = [A, B]
Then the returned pair contains neither Movie A nor Movie B
  (unless fewer than 2 other movies exist)
```

### AC-004: Homepage sorted by Elo
```
Given several movies have Elo data and others do not
When a user views the homepage
Then movies with elo_rank appear first, sorted by elo_rank DESC
And movies with no Elo data appear below, sorted by date_submitted ASC
```

### AC-005: Reset
```
Given a user has made 8 comparisons involving Movie X
When they click Reset on Movie X and confirm
Then all their movie_comparisons rows for Movie X are deleted
And their user_movie_elo row for Movie X is deleted
And movies.elo_rank for Movie X is recomputed (NULL if no other users have data)
And Movie X disappears from their My Rankings tab
```

### AC-006: Minimum pool guard
```
Given only 1 unwatched movie exists
When the user navigates to the comparison screen
Then "Add more movies to start comparing" is shown
And no movie cards are rendered
```

### AC-007: Drag-to-rank removed
```
Given a user is on the homepage
Then no drag handles are visible
And the movies list is sorted by Elo (or date if no Elo data)
```

---

## Error Handling

| Condition | Server response | User message |
|---|---|---|
| TMDB_API_KEY missing | Return movie without TMDB fields | "Movie details unavailable" |
| TMDB API error / timeout | Log server-side; null fields | "Movie details unavailable" |
| < 2 unwatched movies | `BAD_USER_INPUT` | "Add more movies to start comparing" |
| Unauthenticated | `UNAUTHENTICATED` | Redirect to login |
| Movie not found on reset | `NOT_FOUND` | "Movie not found" |

---

## Database Schema

Latest existing migration: `1745500001000_drop-movie-votes.js`

### New migration: `1745600000000_add-elo-ranking-drop-borda.js`

```js
exports.up = (pgm) => {
  // Global Elo average cache
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

  // Drop drag-to-rank table (data is intentionally discarded)
  pgm.dropTable('user_movie_rankings');

  // movies.rank is left in place but is no longer written to or read from.
  // It will contain stale Borda values. A future cleanup migration can drop it.
};

exports.down = (pgm) => {
  pgm.dropTable('user_movie_elo');
  pgm.dropTable('movie_comparisons');
  pgm.dropColumn('movies', 'elo_rank');
  pgm.createTable('user_movie_rankings', {
    user_id:    { type: 'integer', notNull: true, references: '"users"',  onDelete: 'CASCADE' },
    movie_id:   { type: 'integer', notNull: true, references: '"movies"', onDelete: 'CASCADE' },
    rank:       { type: 'numeric(20,10)', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('user_movie_rankings', 'user_movie_rankings_pkey', 'PRIMARY KEY (user_id, movie_id)');
  pgm.createIndex('user_movie_rankings', ['user_id', 'rank']);
};
```

### DB state after migration

| Table | Status | Purpose |
|---|---|---|
| `movie_comparisons` | **New** | Append-only log of This-or-That picks |
| `user_movie_elo` | **New** | Per-user Elo rating per movie |
| `user_movie_rankings` | **Dropped** | Was drag-to-rank fractional index |
| `movies.elo_rank` | **New column** | Global Elo average cache |
| `movies.rank` | Stale, unused | Was Borda count — left for safe rollback |

---

## GraphQL Changes

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

### Removed mutation

```graphql
# REMOVED
reorderMyMovie(id: ID!, afterId: ID): Boolean!
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

// ON CONFLICT DO UPDATE SET user_id = EXCLUDED.user_id is a no-op that returns
// the existing row via RETURNING — avoids a two-query select + insert.
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
  const [rW, rL] = await Promise.all([
    getOrCreateElo(userId, winnerId),
    getOrCreateElo(userId, loserId),
  ]);
  const { newA, newB } = calculateElo(rW, rL);

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

  // AVG returns NULL when no rows match — correctly nullifies elo_rank after reset
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

### `backend/src/pairSelection.ts` (new file)

Implements the three-tier algorithm. Receives the candidate movie list (already filtered by `watched_at IS NULL` and `excludeIds`) with per-user comparison counts and Elo ratings.

```typescript
const K = 5;                       // established threshold
const EP_POOL_MIN = 5;             // minimum EP candidate pool size
const SEED_ELO_BAND = 150;         // ±Elo around median for seeded "peer" pick

interface MovieCandidate {
  id: number;
  title: string;
  tmdb_id: number | null;
  userComparisonCount: number;      // from user_movie_elo for current user, default 0
  elo_rating: number;               // from user_movie_elo for current user, default 1000
}

export function selectPair(movies: MovieCandidate[]): [MovieCandidate, MovieCandidate] {
  if (movies.length < 2) throw new Error('Not enough movies');

  const epPoolSize = Math.max(EP_POOL_MIN, Math.floor(movies.length * 0.1));

  // Tier 1: IFW first pick
  const weights = movies.map(m => 1 / (m.userComparisonCount + 1));
  const first = weightedRandomPick(movies, weights);

  const rest = movies.filter(m => m.id !== first.id);
  const established = rest.filter(m => m.userComparisonCount >= K);

  let second: MovieCandidate;

  if (first.userComparisonCount < K && established.length >= K) {
    // Tier 2: seeded pick
    const median = medianElo(established);
    const peers = established.filter(m => Math.abs(m.elo_rating - median) <= SEED_ELO_BAND);
    const peerPool = peers.length > 0 ? peers : established;
    const rangerPool = established;
    second = Math.random() < 0.5
      ? randomPick(peerPool)
      : randomPick(rangerPool);
  } else if (first.userComparisonCount >= K && established.length > 0) {
    // Tier 3: Elo-proximity pick
    const sorted = [...established].sort(
      (a, b) => Math.abs(a.elo_rating - first.elo_rating) - Math.abs(b.elo_rating - first.elo_rating)
    );
    second = randomPick(sorted.slice(0, epPoolSize));
  } else {
    // Fallback: IFW from remaining
    const restWeights = rest.map(m => 1 / (m.userComparisonCount + 1));
    second = weightedRandomPick(rest, restWeights);
  }

  return [first, second];
}

function weightedRandomPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function medianElo(movies: MovieCandidate[]): number {
  const sorted = [...movies].map(m => m.elo_rating).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
```

### `thisOrThat` resolver — SQL for candidates

```sql
SELECT m.id, m.title, m.tmdb_id,
       COALESCE(ume.comparison_count, 0) AS user_comparison_count,
       COALESCE(ume.elo_rating, 1000)    AS elo_rating
FROM movies m
LEFT JOIN user_movie_elo ume
  ON ume.movie_id = m.id AND ume.user_id = $1
WHERE m.watched_at IS NULL
  AND m.id != ALL($2::int[])
```

Fetch all candidates (not just 2) so `selectPair` can apply weights. Typically 20–100 rows — not a performance concern.

### Updated `movies` resolver — sort order

**Authenticated (userId available):**
```sql
ORDER BY ume.elo_rating DESC NULLS LAST, m.date_submitted ASC
```
Where `ume` is a LEFT JOIN on `user_movie_elo` for `context.user.userId`.

**Unauthenticated:**
```sql
ORDER BY m.elo_rank DESC NULLS LAST, m.date_submitted ASC
```

### `scheduler.ts` — remove Borda code

Remove:
- `recalculateBordaRanks()` function
- `scheduleBordaRecalculation()` export
- `bordaDebounceTimer` variable
- The `await recalculateBordaRanks()` call in `initScheduler()`
- The `setInterval(recalculateBordaRanks, 5 * 60 * 1000)` call

Kometa export scheduler logic is unchanged.

### TMDB enrichment cache — unchanged from previous spec revision

In-memory `Map<number, { data, expiresAt }>` with 24-hour TTL. Three parallel TMDB fetches per uncached movie. Silent null-field fallback on error.

---

## Frontend Changes

### Removed
- Drag-and-drop logic in `Homepage.tsx` (`@dnd-kit` imports, `DndContext`, `SortableContext`, `useSortable`, drag event handlers)
- `REORDER_MY_MOVIE` mutation from `queries.ts`

### New files
- `src/components/home/MovieCompareCard.tsx` — poster, title, year, director, cast, tag chips; full-card click
- `src/components/home/ThisOrThat.tsx` — Compare tab + My Rankings tab

### Changed files

| File | Change |
|---|---|
| `src/graphql/queries.ts` | Remove `REORDER_MY_MOVIE`; add `THIS_OR_THAT`, `MY_RANKINGS`, `RECORD_COMPARISON`, `RESET_MOVIE_COMPARISONS` |
| `src/App.tsx` | `showUserManagement: boolean` → `currentView: 'movies' \| 'this-or-that' \| 'admin'`; render `<ThisOrThat />` for new view |
| `src/components/common/Navbar.tsx` | Replace `showUserManagement: boolean` prop with `currentView`; add "This or That" nav button for all authenticated users |
| `src/components/home/Homepage.tsx` | Remove all `@dnd-kit` code; render static sorted list |

### `ThisOrThat.tsx` key behaviour

- `useLazyQuery(THIS_OR_THAT, { fetchPolicy: 'network-only' })` called on mount and after each pick
- `seenIds: string[]` accumulates both movie IDs from every pair shown this session; passed as `excludeIds`
- `recordComparison` refetches `GET_MOVIES` so the homepage list reflects new Elo ordering
- Rankings tab: `useQuery(MY_RANKINGS, { skip: tab !== 'rankings' })` — not fetched until tab is opened
- Empty state: rendered when error code is `BAD_USER_INPUT`
- Cards in flex row on ≥ sm, stacked on xs

---

## Implementation TODO

### Backend — remove Borda
- [ ] Remove `recalculateBordaRanks`, `scheduleBordaRecalculation`, `bordaDebounceTimer` from `scheduler.ts`
- [ ] Remove the `await recalculateBordaRanks()` call and `setInterval` from `initScheduler()` in `scheduler.ts`
- [ ] Remove `reorderMyMovie` resolver from `resolvers.ts`
- [ ] Remove `reorderMyMovie` mutation from `schema.ts`
- [ ] Update `movies` resolver: replace `ORDER BY m.rank ASC` with Elo-based sort (auth vs unauth branches)

### Backend — add Elo system
- [ ] Create migration `1745600000000_add-elo-ranking-drop-borda.js`
- [ ] Create `backend/src/elo.ts` (`calculateElo`, `getOrCreateElo`, `applyComparison`)
- [ ] Create `backend/src/pairSelection.ts` (three-tier algorithm, `selectPair`)
- [ ] Add `ThisOrThatMovie`, `ThisOrThatPair`, `ComparisonResult`, `MovieRanking` types to `schema.ts`
- [ ] Add `thisOrThat` / `myRankings` queries to `schema.ts`
- [ ] Add `recordComparison` / `resetMovieComparisons` mutations to `schema.ts`
- [ ] Add TMDB enrichment cache + `enrichWithTmdb` helper to `resolvers.ts`
- [ ] Implement `thisOrThat` resolver (fetch candidates with SQL above → `selectPair` → enrich both)
- [ ] Implement `myRankings` resolver
- [ ] Implement `recordComparison` resolver (auth → `applyComparison` → audit log `MOVIE_COMPARISON`)
- [ ] Implement `resetMovieComparisons` resolver (auth → delete rows → recompute → audit log `MOVIE_COMPARISON_RESET`)

### Frontend — remove drag-to-rank
- [ ] Remove `@dnd-kit` code from `Homepage.tsx`
- [ ] Remove `REORDER_MY_MOVIE` from `queries.ts`

### Frontend — add This or That
- [ ] Add `THIS_OR_THAT`, `MY_RANKINGS`, `RECORD_COMPARISON`, `RESET_MOVIE_COMPARISONS` to `queries.ts`
- [ ] Create `MovieCompareCard.tsx`
- [ ] Create `ThisOrThat.tsx`
- [ ] Update `App.tsx`: boolean state → `currentView` union
- [ ] Update `Navbar.tsx`: add `currentView` prop + "This or That" button
