# Plan: Per-User Tag System + "Seen It" Tag + Rewatch Flow

## Summary

Two independent systems working together:

1. **Movie lifecycle (unchanged)**: `watched_at` column stays — "Done" removes from queue with a date
2. **Per-user tag system (new)**: Generic tagging — each user can tag any movie. First tag: "Seen it" (I've personally watched this before). Extensible for future tags (e.g. podcast episode order)
3. **Rewatch flow (new)**: Watched movies can be put back in the queue via "Watch again"

## UX Terminology Changes

| Current | New | Where |
|---------|-----|-------|
| `✓` icon + "Mark as watched" title | `✓` icon + "Done" title | Movie row action button |
| `"Mark [title] as watched? It will be removed from the watchlist."` | `"Mark [title] as done? It'll move to your watch history."` | Confirmation dialog |
| (n/a) | "Seen it" toggle (eye icon) | Movie row — per-user, toggleable |
| (n/a) | "History" link | Navbar (subtle, not prominent) |
| (n/a) | "Watch again" button | History view — brings movie back to queue |
| "I'm in" / "Pass" | No change | Keep as-is |

## Phase 1: Database Migration

**New file**: `backend/migrations/1746200000000_create-tags-system.js`

```sql
-- Tag definitions
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'boolean',  -- 'boolean', 'number', 'text'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user, per-movie tag instances
CREATE TABLE movie_user_tags (
  id SERIAL PRIMARY KEY,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  value TEXT,  -- null for boolean tags; stores number/text for others
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(movie_id, user_id, tag_id)
);

CREATE INDEX idx_movie_user_tags_movie ON movie_user_tags(movie_id);
CREATE INDEX idx_movie_user_tags_user ON movie_user_tags(user_id);

-- Seed the first tag
INSERT INTO tags (slug, label, value_type) VALUES ('seen', 'Seen it', 'boolean');
```

## Phase 2: Backend — GraphQL Schema

Add to `backend/src/schema.ts`:

```graphql
type Tag {
  id: ID!
  slug: String!
  label: String!
  valueType: String!
}

type MovieUserTag {
  tag: Tag!
  user: ConnectionUser!   # reuse existing type (id, username, display_name)
  value: String
  createdAt: String!
}
```

Add fields to `Movie` type:
```graphql
type Movie {
  # ...existing fields...
  myTags: [MovieUserTag!]!      # tags set by the current user on this movie
  userTags: [MovieUserTag!]!    # all users' tags on this movie (visible to everyone)
}
```

Add queries:
```graphql
tags: [Tag!]!                                        # list all tag definitions
watchedMovies(limit: Int, offset: Int): [Movie!]!    # movies with watched_at IS NOT NULL
```

Add mutations:
```graphql
setMovieTag(movieId: ID!, tagSlug: String!, value: String): MovieUserTag!
removeMovieTag(movieId: ID!, tagSlug: String!): Boolean!
unwatchMovie(id: ID!): Movie!    # clears watched_at, sets rank = MAX(rank)+1
```

## Phase 3: Backend — Resolvers

### Field resolvers on Movie

- `Movie.myTags`: If `context.user` exists, query `movie_user_tags` for that user+movie, JOIN `tags` and `users`
- `Movie.userTags`: Query all `movie_user_tags` for that movie, JOIN `tags` and `users`

These only fire when the fields are actually requested in the query (GraphQL lazy resolution).

### Query resolvers

- `tags`: `SELECT * FROM tags ORDER BY slug`
- `watchedMovies(limit, offset)`: `SELECT * FROM movies WHERE watched_at IS NOT NULL ORDER BY watched_at DESC LIMIT $1 OFFSET $2` — requires auth. Includes same requester resolution as existing movie queries.

### Mutation resolvers

- **`setMovieTag(movieId, tagSlug, value)`**: Requires auth. Looks up tag by slug, validates movie exists. UPSERT into `movie_user_tags`. Audit log: `MOVIE_TAG_SET`.
- **`removeMovieTag(movieId, tagSlug)`**: Requires auth. DELETE from `movie_user_tags` WHERE user+movie+tag. Audit log: `MOVIE_TAG_REMOVE`.
- **`unwatchMovie(id)`**: Requires auth. Owner or admin. Sets `watched_at = NULL`, sets `rank = (SELECT COALESCE(MAX(rank), 0) + 1 FROM movies WHERE watched_at IS NULL)`. Audit log: `MOVIE_UNWATCH`.

### Audit log actions (add)

`MOVIE_TAG_SET`, `MOVIE_TAG_REMOVE`, `MOVIE_UNWATCH`

## Phase 4: Frontend — GraphQL Operations

**New queries/mutations in `src/graphql/queries.ts`**:

```typescript
// Tags
export const GET_TAGS = gql`...`;
export const SET_MOVIE_TAG = gql`...`;
export const REMOVE_MOVIE_TAG = gql`...`;

// History
export const WATCHED_MOVIES = gql`...`;
export const UNWATCH_MOVIE = gql`...`;
```

**Update existing queries** to include `myTags` and `userTags` on Movie:
- `GET_MOVIES` — add `myTags { tag { slug label } } userTags { tag { slug label } user { id display_name username } }`

## Phase 5: Frontend — "Seen It" Toggle on Movie Rows

**Modify `MovieRow` component** in `Homepage.tsx`:

- Add an eye icon button (or "Seen" chip) between the TMDB link and the action buttons
- When current user has the "seen" tag → show filled/highlighted eye
- When not → show outlined/dim eye
- Click toggles: calls `setMovieTag` or `removeMovieTag`
- On hover/title: "I've seen this before" / "Mark as seen"
- Below the title or as a small tooltip: show "Seen by: Alice, Bob" if other users have the tag

**Only visible when authenticated.**

### Visual design

```
| Title          | Suggested by | Added       | TMDB | Seen     | Actions |
| Inception      | alice        | Jan 3, 2026 |  ↗   | 👁 (2)  |  ✓  ✕  |
```

- The eye icon is subtle/dim by default, highlighted when the current user has tagged it
- "(2)" shows how many users have seen it — clickable/hoverable to show names

## Phase 6: Frontend — "Done" Terminology Update

- `Homepage.tsx` line 128: Change `title` from `Mark "${movie.title}" as watched` → `Mark "${movie.title}" as done`
- `Homepage.tsx` line 269: Change confirm dialog from `Mark "${movieTitle}" as watched? It will be removed from the watchlist.` → `Mark "${movieTitle}" as done? It'll move to your watch history.`

## Phase 7: Frontend — Watch History View

**New component**: `src/components/home/WatchHistory.tsx`

- Simple paginated list of movies where `watched_at IS NOT NULL`
- Each row shows: title, who suggested it, watched date
- "Watch again" button per movie → calls `unwatchMovie`, confirms first
- Minimal, not prominent — accessed via a subtle "History" link in the navbar

**Navbar change** (`Navbar.tsx`):
- Add "History" nav button (authenticated only), styled more subtle than other nav items (maybe `variant="plain"` with muted color)

**App.tsx change**:
- Add `'history'` to `ViewName` union
- Add routing for history view
- Pass `onShowHistory` callback to Navbar

## Phase 8: Frontend — "Seen It" on Add Movie Flow

After successfully adding a movie (the "Added to the list!" success state), briefly show a "I've seen this" chip/button so the user can immediately tag it. This is optional UX sugar — the user can always toggle it in the row after.

Implementation: In the success message area, add a small button "I've seen it" that calls `setMovieTag` with the newly added movie's ID. Disappears after 3s (same as the success message).

## Phase 9: Backend Tests

**New file**: `backend/src/__tests__/resolvers/tag-resolvers.test.ts`

Test cases:
- `setMovieTag`: happy path (boolean tag), tag with value, movie not found, tag not found, unauthenticated, upsert behavior, audit logging
- `removeMovieTag`: happy path, not found (no-op returns false), unauthenticated
- `unwatchMovie`: happy path (clears watched_at, re-ranks), movie not found, not authorized (not owner/admin), movie not watched (already active), unauthenticated, audit logging
- `watchedMovies`: returns watched movies ordered by watched_at DESC, pagination, unauthenticated
- `tags`: returns all tags
- `Movie.myTags` / `Movie.userTags` field resolvers

## Phase 10: Frontend Tests

- Update existing `Homepage` tests if any exist for the new "Done" wording
- Basic test for `WatchHistory` component

## Files Modified (summary)

| File | Change |
|------|--------|
| `backend/migrations/1746200000000_create-tags-system.js` | **NEW** — tags + movie_user_tags tables |
| `backend/src/schema.ts` | Add Tag, MovieUserTag types; add fields, queries, mutations |
| `backend/src/resolvers.ts` | Add tag/unwatch resolvers, Movie field resolvers |
| `src/graphql/queries.ts` | Add tag/history queries+mutations, update GET_MOVIES |
| `src/models/Movies.ts` | Add myTags/userTags to Movie type |
| `src/components/home/Homepage.tsx` | "Seen it" toggle, "Done" wording, post-add "Seen it" option |
| `src/components/home/WatchHistory.tsx` | **NEW** — watched history view |
| `src/components/common/Navbar.tsx` | Add "History" link |
| `src/App.tsx` | Add history view routing |
| `backend/src/__tests__/resolvers/tag-resolvers.test.ts` | **NEW** — tag system tests |
| `CLAUDE.md` | Update with new tables, actions, queries |

## Order of implementation

1. Migration (Phase 1)
2. Backend schema + resolvers + tests (Phases 2, 3, 9)
3. Frontend GraphQL operations (Phase 4)
4. Frontend "Done" wording (Phase 6) — smallest change, do early
5. Frontend "Seen it" toggle (Phase 5)
6. Frontend history view (Phase 7)
7. Post-add "Seen it" option (Phase 8)
8. Frontend tests (Phase 10)
9. Update CLAUDE.md
