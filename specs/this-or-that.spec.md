# Feature: This or That — Pairwise Movie Ranking

## Overview

A dedicated screen that presents two randomly selected unwatched movies side-by-side and asks the user to pick which one they'd rather watch. Each choice is recorded as a pairwise comparison; an Elo rating system derives a per-user ranking and an aggregate global ranking from accumulated results. The global Elo average replaces the existing manually-managed `rank` column as the canonical movie sort order.

---

## Ranking Algorithm: Elo

Chosen over alternatives because:
- Works optimally for small, fixed pools of items (a watchlist of 20–100 movies)
- Symmetric and simple to implement — no special cases for ties
- Familiar mental model (chess rating); easy to explain to users
- Handles sparse comparisons gracefully (starting rating = 1000, K = 32)

**Formulas:**
```
Expected score:  E_A = 1 / (1 + 10 ^ ((R_B − R_A) / 400))
New rating (winner):  R_A' = R_A + 32 * (1 − E_A)
New rating (loser):   R_B' = R_B + 32 * (0 − E_B)   where E_B = 1 − E_A
```

**Global rank** = arithmetic mean of all users' Elo ratings for a given movie. After each comparison, the affected movies' global Elo averages are recomputed and written to `movies.rank`, replacing the fractional-indexing value.

---

## Functional Requirements

### FR-TOT-001: Navigate to Screen
While logged in, when the user clicks the "This or That" nav link, the system shall display the comparison screen with a randomly selected pair of unwatched movies.

### FR-TOT-002: Movie Pair Selection
When a new comparison pair is needed, the system shall select two distinct unwatched movies at random from the full unwatched pool. The same pair may be presented again in future sessions.

### FR-TOT-003: Movie Card Display
While a comparison pair is displayed, the system shall show for each movie:
- Poster image from TMDB (if `tmdb_id` is set), otherwise a placeholder
- Title
- Release year (from TMDB)
- Director (first director credit from TMDB)
- Top 3 billed cast members (from TMDB credits)
- Up to 5 genre/keyword tags (TMDB genre names first, then TMDB keywords to fill)
- If the movie has no `tmdb_id`, show only the title with a "Not matched to TMDB" note

### FR-TOT-004: TMDB Metadata Fetch
When a comparison pair is requested, the system shall fetch movie details, credits, and keywords from the TMDB API for each movie that has a `tmdb_id`, using three TMDB endpoints:
- `GET /movie/{id}` — release year, poster_path, genres
- `GET /movie/{id}/credits` — cast (top 3), crew (director)
- `GET /movie/{id}/keywords` — keyword tags (used if fewer than 5 genre tags)

### FR-TOT-005: Record Comparison
When the user taps/clicks a movie card, the system shall:
1. Record the comparison (winner_id, loser_id, user_id) in `movie_comparisons`
2. Recalculate Elo ratings for both movies for the current user in `user_movie_elo`
3. Recompute the global average Elo for both movies and write to `movies.rank`
4. Immediately present a fresh random pair (excluding same pair just shown, if possible)

### FR-TOT-006: Prevent Duplicate Pair in Immediate Succession
When a comparison is recorded, the system shall not serve the same pair (in either order) as the very next comparison within the same screen session.

### FR-TOT-007: Session Counter
While the comparison screen is active, the system shall display a running count of comparisons completed in the current session (e.g. "12 comparisons this session").

### FR-TOT-008: Personal Rankings View
When the user navigates to a "My Rankings" tab on the comparison screen, the system shall display all unwatched movies sorted by the user's personal Elo rating (descending), showing each movie's Elo score and number of comparisons involving that movie.

### FR-TOT-009: Reset Movie Comparisons
While viewing the comparison screen or personal rankings, when the user clicks "Reset" on a specific movie, the system shall:
1. Delete all `movie_comparisons` rows where the current user is involved and either movie matches
2. Reset the `user_movie_elo` row for that user+movie back to 1000 with comparison_count = 0
3. Trigger a global rank recomputation for the affected movie

### FR-TOT-010: Minimum Pool Guard
When the unwatched movie pool has fewer than 2 movies, the system shall display an empty state message ("Add more movies to start comparing") and not attempt to fetch a pair.

### FR-TOT-011: Global Rank Write-Back
When any comparison is recorded, the system shall update `movies.rank` for both affected movies to their current global Elo average across all users.

### FR-TOT-012: Auth Guard
When an unauthenticated user attempts to access the comparison screen or call comparison mutations, the system shall return `UNAUTHENTICATED` and redirect to login.

---

## Non-Functional Requirements

### Performance
- Pair query (random selection + TMDB fetch for both movies): < 2 s p95 (TMDB is external; cache metadata for 24 h per `tmdb_id`)
- Comparison record + Elo update + global rank write: < 200 ms p95 (all local DB ops)
- Personal rankings query: < 100 ms p95

### Security
- Comparisons are always recorded against `context.user.userId` from JWT — client cannot submit a different `userId`
- Reset mutation checks that the requesting user owns the records being deleted
- TMDB API key remains server-side only; never exposed to client

### Caching
- TMDB metadata (details, credits, keywords) is cached in-memory or in a `tmdb_cache` table per `tmdb_id` with a 24-hour TTL to avoid redundant API calls during active comparison sessions

### Mobile
- Comparison cards must be usable on a narrow (375 px) screen — stack vertically with equal tap targets

---

## Acceptance Criteria

### AC-001: Happy path — record a comparison
```
Given a logged-in user on the comparison screen with ≥ 2 unwatched movies
When they tap the left movie card
Then that movie's Elo rating for the user increases
And the other movie's Elo rating decreases
And movies.rank for both movies is updated to the new global average
And a new pair is immediately shown
And the session counter increments by 1
```

### AC-002: TMDB-matched movie shows rich metadata
```
Given a movie with a valid tmdb_id
When it appears in a comparison pair
Then its poster, year, director, ≤3 cast names, and ≤5 genre/keyword tags are displayed
```

### AC-003: Unmatched movie shows graceful fallback
```
Given a movie with no tmdb_id
When it appears in a comparison pair
Then only the title and a "Not matched to TMDB" indicator are shown
And no poster placeholder breaks the layout
```

### AC-004: Reset movie comparisons
```
Given a user has made 10 comparisons involving Movie A
When they click "Reset" on Movie A and confirm
Then all their comparison records for Movie A are deleted
And Movie A's Elo for that user resets to 1000
And the global rank for Movie A is recomputed without that user's data
```

### AC-005: Minimum pool guard
```
Given only 1 unwatched movie exists
When the user navigates to the comparison screen
Then "Add more movies to start comparing" is shown
And no movie cards are rendered
```

### AC-006: Same pair not shown twice in a row
```
Given the user just compared Movie A vs Movie B
When the next pair is selected
Then the pair is not Movie A vs Movie B (or Movie B vs Movie A)
```

### AC-007: Personal rankings reflect Elo
```
Given a user has completed comparisons
When they view "My Rankings"
Then movies are listed in descending Elo order
And each row shows Elo score and comparison count
```

### AC-008: Unauthenticated access blocked
```
Given an unauthenticated visitor
When they navigate to /this-or-that
Then they are redirected to the login page
```

---

## Error Handling

| Condition | Response | User Message |
|---|---|---|
| TMDB API key missing | Serve pair without metadata | "Movie details unavailable" |
| TMDB API returns error / timeout | Log server-side, return movie without TMDB fields | "Movie details unavailable" |
| Fewer than 2 unwatched movies | Empty state UI | "Add more movies to start comparing" |
| Unauthenticated comparison mutation | `UNAUTHENTICATED` error | Redirect to login |
| Movie not found during reset | `NOT_FOUND` error | "Movie not found" |

---

## Open Question: Rank Column Conflict with Drag-and-Drop

**Current behaviour**: Admin drag-and-drop writes fractional index values to `movies.rank`.
**New behaviour**: Elo write-back also writes to `movies.rank`.

These will overwrite each other. Options:

| Option | Trade-off |
|---|---|
| **A** Add `elo_rank NUMERIC` column; homepage sorts by `elo_rank` when set, falls back to `rank` | Preserves admin override; most flexible |
| **B** Elo always wins; disable admin drag-and-drop | Simplest; loses admin control |
| **C** Elo writes to `rank`; admin drag-and-drop is a manual override that takes precedence until Elo recalculates | Confusing; ordering can flip unexpectedly |

**Recommendation**: Option A. Spec below assumes this.
**Decision needed from owner before implementation begins.**

---

## Database Schema

### New table: `movie_comparisons`
```sql
CREATE TABLE movie_comparisons (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  loser_id    INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movie_comparisons_user    ON movie_comparisons(user_id);
CREATE INDEX idx_movie_comparisons_winner  ON movie_comparisons(winner_id);
CREATE INDEX idx_movie_comparisons_loser   ON movie_comparisons(loser_id);
```

### New table: `user_movie_elo`
```sql
CREATE TABLE user_movie_elo (
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id          INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  elo_rating        NUMERIC(10,4) NOT NULL DEFAULT 1000,
  comparison_count  INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id)
);
```

### New column: `movies.elo_rank`
```sql
ALTER TABLE movies ADD COLUMN elo_rank NUMERIC(10,4);
-- NULL means no comparisons recorded yet; sort: elo_rank DESC NULLS LAST, rank ASC
```

### Optional: `tmdb_cache`
```sql
CREATE TABLE tmdb_cache (
  tmdb_id     INTEGER PRIMARY KEY,
  payload     JSONB NOT NULL,  -- { poster_path, year, director, cast[3], tags[5] }
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## GraphQL Schema Additions

```graphql
type ThisOrThatPair {
  movieA: ThisOrThatMovie!
  movieB: ThisOrThatMovie!
}

type ThisOrThatMovie {
  id: ID!
  title: String!
  tmdb_id: Int
  poster_url: String          # full URL or null
  release_year: String
  director: String
  cast: [String!]!            # up to 3 names
  tags: [String!]!            # up to 5 genre/keyword strings
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

extend type Query {
  thisOrThat: ThisOrThatPair!        # requires auth
  myRankings: [MovieRanking!]!       # requires auth; sorted by elo_rating DESC
}

extend type Mutation {
  recordComparison(winnerId: ID!, loserId: ID!): ComparisonResult!  # requires auth
  resetMovieComparisons(movieId: ID!): Boolean!                      # requires auth; own data only
}
```

---

## Implementation TODO

### Backend

#### Migration
- [ ] Create migration: add `movie_comparisons` table with indexes
- [ ] Create migration: add `user_movie_elo` table
- [ ] Create migration: add `movies.elo_rank NUMERIC(10,4)` column

#### Elo Service (`backend/src/elo.ts`)
- [ ] Implement `calculateElo(ratingA, ratingB, kFactor=32): { newA, newB }` (pure function)
- [ ] Implement `getOrCreateElo(userId, movieId): Promise<number>` — returns current rating, inserts 1000 row if missing
- [ ] Implement `applyComparison(userId, winnerId, loserId): Promise<ComparisonResult>`:
  1. Get/create Elo rows for both movies
  2. Calculate new ratings
  3. Upsert `user_movie_elo` for both
  4. Recompute `movies.elo_rank` as `AVG(elo_rating)` across all users for each movie
  5. Write to `movies.elo_rank`
  6. Insert into `movie_comparisons`
  7. Return result

#### TMDB Enrichment (`backend/src/tmdb.ts`)
- [ ] Implement `fetchTmdbEnriched(tmdbId): Promise<TmdbEnriched>` — calls `/movie/{id}`, `/movie/{id}/credits`, `/movie/{id}/keywords`; constructs `poster_url`, `release_year`, `director`, `cast[3]`, `tags[5]` (genres first, then keywords)
- [ ] Implement `getCachedOrFetch(tmdbId)` — check `tmdb_cache`; if stale (>24 h) or missing, call `fetchTmdbEnriched` and upsert cache

#### Schema (`backend/src/schema.ts`)
- [ ] Add `ThisOrThatPair`, `ThisOrThatMovie`, `ComparisonResult`, `MovieRanking` types
- [ ] Add `thisOrThat`, `myRankings` queries
- [ ] Add `recordComparison`, `resetMovieComparisons` mutations

#### Resolvers (`backend/src/resolvers.ts`)
- [ ] `thisOrThat`: query 2 random unwatched movies; call `getCachedOrFetch` for each; return pair
- [ ] `myRankings`: join `user_movie_elo` → `movies` for current user; sort by `elo_rating DESC`
- [ ] `recordComparison`: auth check; call `applyComparison`; log `MOVIE_COMPARISON` audit event
- [ ] `resetMovieComparisons`: auth check; delete own `movie_comparisons` rows; reset `user_movie_elo` to 1000/0; recompute `elo_rank`

#### Audit Log
- [ ] Add `MOVIE_COMPARISON` and `MOVIE_COMPARISON_RESET` to audit log actions

### Frontend

#### Route & Nav
- [ ] Add `/this-or-that` route in `App.tsx`
- [ ] Add "This or That" link to `Navbar.tsx` (visible to all logged-in users)

#### GraphQL Queries (`src/graphql/queries.ts`)
- [ ] Add `THIS_OR_THAT` query
- [ ] Add `MY_RANKINGS` query
- [ ] Add `RECORD_COMPARISON` mutation
- [ ] Add `RESET_MOVIE_COMPARISONS` mutation

#### Components
- [ ] `src/components/home/ThisOrThat.tsx` — main screen with two tabs: "Compare" and "My Rankings"
  - Compare tab: renders two `MovieCompareCard` components side-by-side; session counter; empty state
  - My Rankings tab: renders ranked list with Elo scores
- [ ] `src/components/home/MovieCompareCard.tsx` — poster, title, year, director, cast chips, tag chips; full-card click target; loading skeleton while fetching
- [ ] `src/components/home/MyRankings.tsx` — sorted movie list with Elo badge and comparison count; "Reset" button per movie with confirmation

#### State
- [ ] Track `lastPairIds` in component state to avoid immediate repeat
- [ ] Track `sessionCount` in component state (reset on unmount)

### Testing
- [ ] Unit test `calculateElo` — verify Elo delta for equal ratings, underdog win, heavy favourite win
- [ ] Integration test `recordComparison` — verify DB rows and Elo values after a comparison
- [ ] Integration test `resetMovieComparisons` — verify rows deleted and Elo reset to 1000

---

## Out of Scope

- Viewing other users' personal rankings (only own rankings visible)
- Comparison history / timeline UI
- Skip / "Haven't seen either" button (can be added later)
- Weighted K-factor that decreases with more comparisons (can tune later)
- Admin ability to manually set a movie's Elo (out of scope for now)
- Push notifications or gamification (streaks, badges)
