# Feature: TV Shows as a Second Content Kind

**Status:** Phases 1–3 landed (PR #102, #103, #104). Phase 4 (frontend: URL routing, KindContext,
navbar toggle, kind-aware views) implemented on branch `phase-4-frontend`. Phase 5 not started.
**Mockup:** `specs/mockups/tv-shows-ui.html` (merged in `cd1cc87`)

> **Provenance note.** The original implementation plan for this feature was lost — it lived in a
> vibe-kanban task (branch prefix `60a7`) and vibe-kanban was removed from the homelab in
> nova-config `1eccb89`. This spec was reconstructed on 2026-09-15 from the surviving artifacts:
> the Phase 1 migrations and their doc comments, the UI mockup, the PR #102 description, and a
> full read of the current movie implementation. Where the original intent could not be recovered,
> this spec makes the **simplest decision that fits what Phase 1 already committed to**, and marks
> it as a decision (D-n) so it can be challenged rather than mistaken for received wisdom.

---

## Overview

MovieNight tracks a shared queue of movies: users add them, rank them pairwise with Elo, mark them
watched, and the queue is exported to Plex via MDBList + Kometa. This feature adds **TV shows** as a
second, parallel content kind with the same lifecycle.

Shows are **parallel to** movies, not mixed with them. A user switches the whole app between
Movies and Shows with a segmented toggle in the navbar; every downstream view (Queue, This or That,
Combined, History) follows that selection.

### Goals

- Add, match, rank, tag, watch and un-watch TV shows with the same affordances as movies.
- Keep movie behaviour byte-identical — this feature is additive.
- Export show collections to Plex through the same MDBList → Kometa path, without disturbing movies.
- Share backend logic between kinds via kind-parameterised helpers, so the two stacks don't drift.

### Non-goals (out of scope)

- ~~**Episode-level progress** (`S2E4`).~~ **Shipped** (issue #107) as manual, household-shared
  progress — see D-16–D-19. Plex-sourced sync (option A) and per-user progress (option B) remain out
  of scope.
- **Cross-kind comparison.** A movie is never compared against a show. Elo pools are strictly
  separate — this is already baked into the Phase 1 migrations.
- **Letterboxd import for shows.** Letterboxd is a film service; `importFromLetterboxd` stays
  movies-only.
- **Per-kind export schedules.** One schedule drives both kinds (D-9).
- **Seeding shows.** `seedMovies` is a dev-only fixture; no `seedShows`.

---

## Kind model and decisions

| #        | Decision                                                                                                                                                                                                          | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D-1**  | Separate `shows` table mirroring `movies`; no polymorphic `content` table.                                                                                                                                        | Landed in Phase 1. A shared table would need a nullable-column union of movie and TV fields and a discriminator on every query; two tables keep every existing movie query untouched.                                                                                                                                                                                                                                                                        |
| **D-2**  | Elo pools strictly separate per kind.                                                                                                                                                                             | Landed (`show_comparisons`, `user_show_elo`). "Is _Andor_ better than _Dune_?" is not a question users can answer consistently, and mixing pools would make both rankings noisier.                                                                                                                                                                                                                                                                           |
| **D-3**  | Shared `tags` definition table; separate `show_user_tags` instances.                                                                                                                                              | Landed. The `seen` tag is generic; re-seeding per kind would duplicate rows for no gain.                                                                                                                                                                                                                                                                                                                                                                     |
| **D-4**  | Separate GraphQL root fields per kind (`shows`, `addShow`, …), **not** a `kind:` argument on the existing fields.                                                                                                 | `Movie` and `Show` have genuinely different fields (`director`/`release_year` vs `created_by`/`networks`/`number_of_seasons`). A `kind` arg would force a union or interface return type and break every existing client selection set. Duplicated root fields are more SDL but zero risk to movies.                                                                                                                                                         |
| **D-5**  | Share backend _logic_ through kind-parameterised helpers in `contentActions.ts`; keep resolvers as thin per-kind wrappers.                                                                                        | The `CONTENT_TABLE` / `AUDIT_TARGET_TYPE` maps landed in Phase 1 for exactly this. Thin wrappers keep stack traces and auth gates readable; the helpers prevent drift.                                                                                                                                                                                                                                                                                       |
| **D-6**  | Kind lives in the URL path (`/shows/queue`). Implemented with the History API directly — **no router dependency**.                                                                                                | The app has no router today (`App.tsx:23` is a `useState`). Adding react-router to satisfy one toggle is disproportionate; ~40 lines of `pushState` + `popstate` gives shareable, refresh-faithful URLs. Revisit if a second URL-driven feature appears.                                                                                                                                                                                                     |
| **D-7**  | Kind is **global**, not per-view. One toggle in the navbar cascades to Queue, This or That, Combined and History.                                                                                                 | Straight from the mockup's rationale: "Tabs suggest peer views of the _same_ data; a segmented toggle communicates a _content-type filter_ that cascades through every downstream view."                                                                                                                                                                                                                                                                     |
| **D-8**  | Separate MDBList list, separate Kometa YAML file, and separate Plex label per kind.                                                                                                                               | The Plex reconciler deletes by label (see Hazard H-1). Sharing any of the three causes one kind's export to destroy the other's collections.                                                                                                                                                                                                                                                                                                                 |
| **D-9**  | One scheduled job exports both kinds sequentially. No `kind` column on `kometa_schedule`.                                                                                                                         | `kometa_schedule` is a single row (`WHERE id = 1` in 8 places) and `scheduler.ts` holds a single module-level timer. Per-kind schedules mean a schema change and a timer registry, for a feature nobody asked for.                                                                                                                                                                                                                                           |
| **D-10** | Rename `movieCount` → `itemCount` and `totalMovies` → `totalItems` across export code, GraphQL and audit metadata.                                                                                                | These names become lies once shows export. The only consumer is our own frontend (`queries.ts:215`), so a clean rename beats a deprecated alias.                                                                                                                                                                                                                                                                                                             |
| **D-11** | `SHOW_ADD` push event added to the `NOTIFICATION_EVENT_TYPES` whitelist.                                                                                                                                          | No migration needed — `1746700001000`'s doc comment states the whitelist is the extension point.                                                                                                                                                                                                                                                                                                                                                             |
| **D-12** | Episode progress is out of scope; the mockup's dashed `S · E` pill ships as reserved empty space.                                                                                                                 | Keeps layout stable so progress can land later without reflowing rows — the mockup's stated intent.                                                                                                                                                                                                                                                                                                                                                          |
| **D-13** | Shows have **no manual reordering** and no `rank` column. Ordering is personal Elo, then `date_submitted`.                                                                                                        | Landed: the `shows` migration omits `rank` as "deprecated post-Elo". Drag-to-rank is already gone from movies — there is no `reorderMovie` in `backend/src/schema.ts`, no `REORDER_MOVIE` in `queries.ts`, and no `@dnd-kit` import anywhere in `src/`. The drag handles in the mockup are vestigial copies of the pre-Elo movie UI and must **not** be built.                                                                                               |
| **D-14** | The Combined view is per-kind: "Alice + Me, Shows". No cross-kind combined list.                                                                                                                                  | Follows from D-2 — a combined list is an Elo join.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **D-15** | Show queue/detail queries are public (unauthenticated) exactly like `movies`/`movie`.                                                                                                                             | Mirrors existing behaviour (`resolvers.ts:158`, `:187`). Deliberate parity, not an oversight — flagged here so it's a conscious choice.                                                                                                                                                                                                                                                                                                                      |
| **D-16** | Episode progress is **manual and household-shared** — three columns on `shows` (`next_season`, `next_episode`, `progress_updated_at`), not a per-user table and not Plex-sourced (issue #107, option C + shared). | The owner chose manual-only + shared. Simplest possible cut: no new table, no Plex client work, no scheduler. The derived `Show.episode_progress` GraphQL field and the ordering read only these two columns, so Plex-sourced (option A) or per-user (option B) progress can layer on later without a rewrite.                                                                                                                                               |
| **D-17** | A show is "in progress" iff **both** `next_season` and `next_episode` are set. Clearing either (or marking watched) ends it.                                                                                      | One condition drives both the chip and the ordering. Storing a bare `in_progress` boolean would be a second source of truth to keep in sync; deriving it from the two columns can't drift.                                                                                                                                                                                                                                                                   |
| **D-18** | `setShowProgress` auth gate = **owner / admin / accepted-connection**, identical to `markShowWatched`.                                                                                                            | Progress is one shared value, so "whoever can mark it watched can say where we're up to" is the consistent household rule. Reuses `assertOwnerAdminOrConnection`. Deliberately wider than `unwatchShow`'s owner-or-admin gate.                                                                                                                                                                                                                               |
| **D-19** | Ordering prepends `(next_season IS NOT NULL) DESC` to the existing show-queue `ORDER BY` (both authed and anon). No separate "Continue watching" section in the first cut.                                        | In-progress-first is the acceptance criterion; a one-clause sort delivers it. A visually distinct "Continue watching" group is deferred as pure UI polish — the chip already marks in-progress rows.                                                                                                                                                                                                                                                         |
| **D-20** | The progress editor uses **Season/Episode dropdowns**: Season bounded by `number_of_seasons`, Episode by `number_of_episodes` (the series total). No per-season episode cap.                                      | Dropdowns of valid numbers beat free-text — no typos, no out-of-range values. The data model stores only series totals, not a per-season breakdown, so the episode bound is the series total (a safe superset), not the selected season's count. A tight per-season cap would need new TMDB data (`seasons[].episode_count`) — deferred as disproportionate. Unfetched shows fall back to generous constants; any already-set value is always kept in range. |

### Terminology

Per the CLAUDE.md style guide, user-facing verbs are unchanged and kind-agnostic: **Done** (mark
watched), **Watch again** (requeue), **Seen it** (per-user tag), **Remove** (admin delete). The only
new user-facing nouns are **Movies** / **Shows** in the toggle and the per-row kind chip.

---

## Phase 1 — landed (PR #102)

Recorded here so later phases know what they can assume.

**Migrations** (`backend/migrations/`):

| Timestamp       | Table                       | Notes                                                                                                                                                                                  |
| --------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1748000000000` | `shows`                     | Mirrors `movies`, minus `rank` and the legacy `requester` varchar. Adds `first_air_year`, `created_by text[]`, `networks text[]`, `number_of_seasons`, `number_of_episodes`, `status`. |
| `1748000001000` | `show_comparisons`          | Mirrors `movie_comparisons`.                                                                                                                                                           |
| `1748000002000` | `user_show_elo`             | PK `(user_id, show_id)`.                                                                                                                                                               |
| `1748000003000` | `show_interest`             | PK `(user_id, show_id)`.                                                                                                                                                               |
| `1748000004000` | `show_user_tags`            | Unique `(show_id, user_id, tag_id)`; FK to the shared `tags`.                                                                                                                          |
| `1748000005000` | `kometa_mdblist_lists.kind` | `varchar(20) NOT NULL DEFAULT 'movie'`; unique key widened to `(list_type, ref_id, environment, kind)`.                                                                                |

**Code**: `backend/src/tmdb.ts` (kind-dispatched TMDB adapter, discriminated
`Tmdb{Movie,Show}Metadata` union, handles the TV keywords quirk — `.keywords` for movies,
`.results` for TV) and `backend/src/contentActions.ts` (`logAudit`,
`triggerMdblistSyncInBackground`, `CONTENT_TABLE`, `AUDIT_TARGET_TYPE`).

**Follow-up fix** (`4d6766b`): `kometaExport.ts` still used the dropped 3-column `ON CONFLICT`
target, which would have failed every new-list insert _after_ `createList` had already created the
list on MDBList. Now carries `kind` and uses the 4-column target, scoped by `LIST_KIND = 'movie'`.

**Verified**: all six migrations applied cleanly on `movienight-test`. Rollback is **not** yet
verified — do that before merging to `master`.

---

## Trip-wires left by Phase 1

Phase 1 is additive, but it left live code that is _correct only while shows don't exist_. Each of
these becomes a bug the moment show rows appear. Line numbers are as of `4d6766b`.

| #       | Location                                           | Problem when shows exist                                                                                                                                                                                                                                  |
| ------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H-1** | `kometaExport.ts:320` `reconcilePlexCollections`   | Deletes every Plex collection carrying `MOVIENIGHT_PLEX_LABEL` whose name isn't in the current run's list. A shows-only run against the shared label **deletes all movie collections**. Fix in Phase 5 via per-kind label + per-kind section.             |
| **H-2** | `kometaExport.ts:307`                              | Output filename is hardcoded `movienight.yml`. A shows export clobbers the movies file.                                                                                                                                                                   |
| **H-3** | `kometaExport.ts:236-237`                          | YAML emits `radarr_add_missing` / `radarr_search`. Shows need `sonarr_add_missing` / `sonarr_search`.                                                                                                                                                     |
| **H-4** | `mdblist.ts:53, :67, :87`                          | Payload/response key is literally `movies`. Shows need `{ shows: [{ tmdb: id }] }`. `MdbListItemsResponse` (`:17-20`) already declares both fields.                                                                                                       |
| **H-5** | `plexClient.ts:61`                                 | `dirs.find(d => d.type === 'movie')` — needs a `sectionType` parameter (`'movie' \| 'show'`).                                                                                                                                                             |
| **H-6** | `resolvers.ts:292-295`, `:1152-1155`, `:1197-1200` | Three byte-identical `SELECT … FROM kometa_mdblist_lists WHERE environment = $1` with **no `kind` filter** — will silently mix show lists into `KometaSchedule.exportedLists`. All three also hardcode `movieCount: 0`. Extract to one kind-aware helper. |
| **H-7** | `kometaExport.ts:166` `const LIST_KIND = 'movie'`  | Deliberate Phase 1 placeholder. Must become a threaded `kind` parameter.                                                                                                                                                                                  |
| **H-8** | `kometaExport.ts:109, :138`                        | `getCombinedTmdbIds` / `getSoloTmdbIds` hardcode `movies`, `user_movie_elo`, `movie_interest` and the `movie_id` column.                                                                                                                                  |
| **H-9** | `scheduler.ts:6`                                   | Single module-level `scheduledTimeout`; a naive second `scheduleNext` call clobbers the first. See D-9.                                                                                                                                                   |

---

## Phase 2 — Backend GraphQL surface

**Deliverable:** shows are fully usable through the API. No frontend changes.

### 2.1 New SDL (`backend/src/schema.ts`)

```graphql
type Show {
  id: ID!
  title: String!
  requester: String! # from requested_by join only — no legacy varchar fallback
  requested_by: ID
  date_submitted: String!
  elo_rank: Float
  tmdb_id: Int
  watched_at: String
  poster_url: String
  first_air_year: String
  created_by: [String!]!
  networks: [String!]!
  number_of_seasons: Int
  number_of_episodes: Int
  status: String
  myTags: [ShowUserTag!]!
  userTags: [ShowUserTag!]!
}

type ShowUserTag {
  tag: Tag!
  user: ConnectionUser!
  value: String
  createdAt: String!
}

type TmdbShow {
  tmdb_id: Int!
  title: String!
  first_air_year: String
  overview: String
}

type ThisOrThatShow {
  id: ID!
  title: String!
  tmdb_id: Int
  poster_url: String
  first_air_year: String
  created_by: [String!]!
  networks: [String!]!
  number_of_seasons: Int
  number_of_episodes: Int
  cast: [String!]!
  tags: [String!]!
}

type ThisOrThatShowPair {
  showA: ThisOrThatShow!
  showB: ThisOrThatShow!
}
type ShowComparisonResult {
  winnerId: ID!
  loserId: ID!
  winnerElo: Float!
  loserElo: Float!
}
type ShowRanking {
  show: Show!
  eloRating: Float!
  comparisonCount: Int!
}
type CombinedShowRanking {
  show: Show!
  userAElo: Float
  userBElo: Float
  combinedElo: Float!
  bothRated: Boolean!
}
type CombinedShowListResult {
  connection: UserConnection!
  rankings: [CombinedShowRanking!]!
}
type PendingReviewShow {
  show: Show!
  addedBy: ConnectionUser!
}
type SetShowInterestResult {
  showId: ID!
  interested: Boolean!
}
```

`Tag`, `ConnectionUser` and `UserConnection` are reused unchanged.

### 2.2 New Queries and Mutations

Each mirrors its movie twin exactly — same auth gate, same error codes, same limit clamps.

| New field                                                                    | Mirrors                             | Auth gate                                                          |
| ---------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `shows: [Show!]!`                                                            | `movies` (`:158`)                   | none — branches on `context.user` for personal Elo ordering (D-15) |
| `show(id: ID!): Show`                                                        | `movie` (`:187`)                    | none (D-15)                                                        |
| `searchTmdbShows(query: String!): [TmdbShow!]!`                              | `searchTmdb` (`:139`)               | `context.user`                                                     |
| `showThisOrThat(excludeIds: [ID!]): ThisOrThatShowPair!`                     | `thisOrThat` (`:326`)               | `context.user`                                                     |
| `myShowRankings: [ShowRanking!]!`                                            | `myRankings` (`:403`)               | `context.user`                                                     |
| `combinedShowList(connectionId: ID!): CombinedShowListResult!`               | `combinedList` (`:492`)             | `context.user` + accepted connection involving caller              |
| `newShowsFromConnections: [PendingReviewShow!]!`                             | `newMoviesFromConnections` (`:560`) | `context.user`                                                     |
| `soloShows: [Show!]!`                                                        | `soloMovies` (`:592`)               | `context.user`                                                     |
| `passedShowIds: [ID!]!`                                                      | `passedMovieIds` (`:624`)           | `context.user`                                                     |
| `watchedShows(limit: Int, offset: Int): [Show!]!`                            | `watchedMovies` (`:647`)            | `context.user`; limit clamped 1..200, default 50                   |
| `addShow(title: String!, tmdb_id: Int): Show!`                               | `addMovie` (`:685`)                 | `context.user`; title trimmed, 1..500                              |
| `matchShow(id: ID!, tmdb_id: Int!, title: String!): Show!`                   | `matchMovie` (`:737`)               | owner-or-admin                                                     |
| `markShowWatched(id: ID!): Show!`                                            | `markWatched` (`:786`)              | owner **or admin or accepted-connection-of-owner**                 |
| `unwatchShow(id: ID!): Show!`                                                | `unwatchMovie` (`:2145`)            | owner-or-admin                                                     |
| `deleteShow(id: ID!): Boolean!`                                              | `deleteMovie` (`:850`)              | `isAdmin`                                                          |
| `recordShowComparison(winnerId: ID!, loserId: ID!): ShowComparisonResult!`   | `recordComparison` (`:871`)         | `context.user`                                                     |
| `resetShowComparisons(showId: ID!): Boolean!`                                | `resetMovieComparisons` (`:900`)    | `context.user`, self-scoped                                        |
| `setShowInterest(showId: ID!, interested: Boolean!): SetShowInterestResult!` | `setMovieInterest` (`:2014`)        | `context.user`                                                     |
| `setShowTag(showId: ID!, tagSlug: String!, value: String): ShowUserTag!`     | `setMovieTag` (`:2054`)             | `context.user`                                                     |
| `removeShowTag(showId: ID!, tagSlug: String!): Boolean!`                     | `removeMovieTag` (`:2109`)          | `context.user`                                                     |
| `backfillShowTmdbData: Int!`                                                 | `backfillTmdbData` (`:1794`)        | `isAdmin`                                                          |

> **Deliberate asymmetry to preserve:** `markWatched` accepts an accepted-connection-of-owner, while
> `unwatchMovie` is owner-or-admin only. Mirror this exactly rather than "fixing" it in passing —
> if it should change, change it for both kinds in its own PR.

### 2.3 `elo.ts` — parameterise by kind

Currently four movie-hardcoded references. Add a registry and thread `kind` through:

```ts
const ELO_TABLE: Record<Kind, string> = { movie: 'user_movie_elo', show: 'user_show_elo' };
const ELO_ID_COLUMN: Record<Kind, string> = { movie: 'movie_id', show: 'show_id' };
const COMPARISONS_TABLE: Record<Kind, string> = {
  movie: 'movie_comparisons',
  show: 'show_comparisons',
};
// CONTENT_TABLE already exists in contentActions.ts
```

New signatures: `getOrCreateElo(kind, userId, contentId)`, `applyComparison(kind, userId, winnerId,
loserId)`, `updateGlobalEloRank(kind, contentId)`. `calculateElo` is pure and unchanged.

The show tables mirror the movie ones exactly, so no shape differences — the maps are sufficient.

> **Identifier interpolation:** these table/column names are interpolated into SQL strings, which is
> the one place the codebase does so. They come from a closed `Record<Kind, string>` keyed by a union
> type — never from user input. Keep it that way, and keep every _value_ parameterised (`$1, $2, …`).

### 2.4 `pairSelection.ts` — rename only

`MovieCandidate` → `ContentCandidate`; `selectPair(movies)` → `selectPair(candidates)`; error string
`'Not enough movies'` → `'Not enough items'`. The module reads no tables and never inspects
`tmdb_id`, so it is reusable as-is. Update the import in `resolvers.ts:20`.

### 2.5 `contentActions.ts` — grows per its own doc comment

Add kind-parameterised helpers that both stacks call:

- `updateWatchedState(kind, id, watched: boolean)` — the `UPDATE … SET watched_at` for both
  directions. Note the movie version also recomputes `rank` on unwatch (`resolvers.ts:2165`); shows
  have no `rank`, so the helper must skip that for `kind === 'show'`.
- `assertOwnerOrAdmin(kind, context, id)` and `assertOwnerAdminOrConnection(kind, context, id)` —
  the two auth shapes above, in one place.
- `upsertTag(kind, ...)` / `removeTag(kind, ...)` over `movie_user_tags` / `show_user_tags`.
- `setInterest(kind, ...)` over `movie_interest` / `show_interest`.

### 2.6 Audit actions (add to the CLAUDE.md list)

`SHOW_ADD`, `SHOW_WATCHED`, `SHOW_DELETE`, `SHOW_TMDB_MATCH`, `SHOW_INTEREST_SET`, `SHOW_TAG_SET`,
`SHOW_TAG_REMOVE`, `SHOW_UNWATCH`, `SHOW_COMPARISON`, `SHOW_COMPARISON_RESET`.

`target_type` is `'show'` (already in `AUDIT_TARGET_TYPE`). MDBList auto-sync trigger strings are
`'show_watched'` / `'show_unwatch'`, with metadata `{ showId, title, tmdbId }`.

### 2.7 Push notifications

Extend `NOTIFICATION_EVENT_TYPES` (`resolvers.ts:26`) to `['MOVIE_ADD', 'SHOW_ADD']`. No migration —
an absent preference row means enabled. `addShow` fires `sendPushToConnectionsOf(userId, 'SHOW_ADD',
{ title: 'MovieNight', body: `${requesterName} added "${title}" to the shows queue`, url: '/shows',
tag: `show-add-${id}` })`, fire-and-forget, exactly as `addMovie` does at `:725-730`.

### 2.8 Functional requirements

**FR-SHOW-001: Add a show.** When an authenticated user submits a non-empty title of 1–500
characters, the system shall insert a row into `shows` with `requested_by` set to the caller, log
`SHOW_ADD`, fire a `SHOW_ADD` push to the requester's accepted connections, and — if `tmdb_id` was
supplied — fetch TMDB metadata in the background via `fetchAndStoreTmdbData('show', …)`.

**FR-SHOW-002: Show queue ordering.** The `shows` query shall return only rows where `watched_at IS
NULL`. For an authenticated caller it shall order by that caller's `user_show_elo.elo_rating`
descending, NULLS LAST, then `date_submitted` ascending; for an anonymous caller, by
`shows.elo_rank`. There is no manual ordering (D-13).

**FR-SHOW-003: TMDB show search.** When an authenticated user searches, the system shall call the
TMDB `/search/tv` endpoint via `searchTmdb('show', query)`, return at most 10 results mapping
`name` → `title` and `first_air_date` → `first_air_year`, and throw `INTERNAL_SERVER_ERROR` if
`TMDB_API_KEY` is unset.

**FR-SHOW-004: Show metadata.** On a successful TMDB fetch the system shall persist `poster_path`,
`first_air_year`, `created_by[]`, `networks[]`, `cast_list[]` (top 3 billed), `genre_tags[]` (up to
5: genres first, padded with keywords), `number_of_seasons`, `number_of_episodes`, `status` and
`tmdb_fetched_at`. If the detail request fails, the system shall write nothing and leave
`tmdb_fetched_at` null so the backfill retries.

**FR-SHOW-005: Pairwise show comparison.** When a user picks a winner, the system shall insert into
`show_comparisons`, upsert both ratings in `user_show_elo`, update `shows.elo_rank` to the
cross-user `AVG(elo_rating)`, and log `SHOW_COMPARISON`. Shows shall never be paired against movies.

**FR-SHOW-006: Fewer than two shows.** When fewer than two unwatched shows exist, `showThisOrThat`
shall throw `BAD_USER_INPUT` with a message directing the user to add more shows.

**FR-SHOW-007: Done and Watch again.** `markShowWatched` shall set `watched_at = NOW()`, log
`SHOW_WATCHED`, and trigger a background MDBList sync with trigger `'show_watched'`. `unwatchShow`
shall clear `watched_at`, log `SHOW_UNWATCH`, and sync with trigger `'show_unwatch'`. Unlike movies,
neither shall touch a `rank` column.

**FR-SHOW-008: Per-user show tags.** `setShowTag` / `removeShowTag` shall operate on
`show_user_tags` against the shared `tags` definitions, upserting on `(show_id, user_id, tag_id)`,
and shall reject an unknown `tagSlug` with `BAD_USER_INPUT`.

**FR-SHOW-009: Requester resolution.** `Show.requester` shall resolve to `display_name ||
username || 'Unknown'` from the `requested_by` join. The `shows` table has no legacy `requester`
varchar, so there is no fallback branch.

---

## Phase 3 — `MovieRow` → `ContentRow` rename

**Deliverable:** a mechanical, behaviour-free rename in its own PR, so the Phase 4 diff is readable.

`MovieRow` and `MovieCard` have identical props apart from `rank?` and contain no movie-specific
logic beyond copy and the TMDB URL.

| Before                                                              | After                                                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/components/home/MovieRow.tsx` → `MovieRow`, `MovieRowProps`    | `ContentRow.tsx` → `ContentRow`, `ContentRowProps`                                                                |
| `src/components/home/MovieCard.tsx` → `MovieCard`, `MovieCardProps` | `ContentCard.tsx` → `ContentCard`, `ContentCardProps` (export the props interface — it currently isn't)           |
| `src/models/Movies.ts` → `Movie`, `MovieUserTag`                    | `src/models/Content.ts` → `Movie`, `Show`, `MovieUserTag`, `ShowUserTag`, plus `type ContentItem = Movie \| Show` |

Both components gain a required `kind: ContentKind` prop and take `item: ContentItem` instead of
`movie: Movie`. In this PR every callsite passes `kind="movie"` and behaviour is unchanged.

Consumers to update: `Homepage.tsx:16-36` (imports), `:1035-1050`, `:1072-1088`, `:859-923`.

**Not renamed in this phase** (avoid scope creep): `MovieCompareCard`, `AddMovieForm`,
`WatchHistoryCard`, `TmdbMatchFlow`. Phase 4 makes those kind-aware where needed.

**Acceptance:** `npm test -- --watchAll=false` passes unchanged, and `git diff` shows no behavioural
change — only identifiers, imports and filenames.

---

## Phase 4 — Frontend

**Deliverable:** the mockup, working.

### 4.1 URL-driven navigation (D-6)

Today `App.tsx:19` defines `type ViewName = 'movies' | 'this-or-that' | 'combined-list' | 'history'
| 'admin'` and `:23` holds it in `useState`. Replace with a `(kind, view)` pair derived from
`location.pathname`.

| Path                                          | kind                                                 | view                                         |
| --------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| `/movies`, `/shows`                           | from segment                                         | queue                                        |
| `/movies/this-or-that`, `/shows/this-or-that` | from segment                                         | this-or-that                                 |
| `/movies/combined`, `/shows/combined`         | from segment                                         | combined-list                                |
| `/movies/history`, `/shows/history`           | from segment                                         | history                                      |
| `/admin`                                      | n/a                                                  | admin                                        |
| `/`                                           | last used (localStorage `contentKind`), else `movie` | queue — `replaceState` to the canonical path |
| anything else                                 | `movie`                                              | queue — `replaceState` to `/movies`          |

Implementation: a `parsePath(pathname): { kind, view }` pure function (unit-tested), a `navigate(view,
kind)` helper doing `history.pushState`, and a `popstate` listener so Back/Forward work. `?resetToken=`
handling in `App.tsx:26-29` is unaffected.

`ViewName` is duplicated verbatim in `Navbar.tsx:9` — move both to `src/models/Content.ts` and import.

**Nginx:** already handled — `nginx.conf:19-20` serves `try_files $uri $uri/ /index.html;`, so deep
links survive a refresh in the production image with no config change.

### 4.2 `KindContext`

```ts
export type ContentKind = 'movie' | 'show';
interface KindContextValue {
  kind: ContentKind;
  setKind: (k: ContentKind) => void;
}
```

`setKind` calls `navigate(currentView, k)` — switching kind preserves the current view, per D-7 —
and writes `localStorage.contentKind`. Provider nests inside `AuthProvider` in `src/index.tsx`.

### 4.3 Navbar segmented toggle

Per the mockup: a `role="tablist"` segmented control between the brand and the nav links, always
visible, with two `role="tab"` buttons carrying `aria-selected`. Each has a Lucide-style icon
(`film` for movies, `tv` for shows) **and** a text label — color is never the only cue (WCAG 1.4.1).
A 2px `kind-underline` strip below the navbar takes the active kind's accent.

Nav items themselves are unchanged (`Navbar.tsx:35-127`); they keep their existing active-state
recipe and simply route within the current kind. The toggle renders in both the desktop bar and the
mobile drawer.

### 4.4 Kind accent tokens

Add to `src/index.css:2-16`:

```css
--mn-kind-movie: #f59e0b;
--mn-kind-movie-tint: #fef3c7;
--mn-kind-show: #0ea5e9;
--mn-kind-show-tint: #e0f2fe;
```

These are **kind affordance** colors — the toggle, the row left-border, the kind chip and the navbar
underline. **Superseded during Phase 4 review (product decision):** the original "gold `primary`
palette stays unchanged; do not restyle buttons/links per kind" guidance was reversed — on Shows the
whole `primary` palette is repainted gold → blue via `KindPalette` + `SHOW_PALETTE_VARS` (`theme.ts`)
overriding `--joy-palette-primary-*` on `:root`. The tints are light-mode values from the mockup and
need dark-mode
equivalents (the app is dark-only, `index.tsx:16`); use a low-alpha overlay of the accent instead.

### 4.5 Views

All queue/history/compare views read `kind` from context and pick the matching operation. Poll
intervals mirror the movie ones (`GET_SHOWS` at 5 s, etc.).

- **Queue** (`Homepage.tsx`): swap ops by kind. Rows gain a left border in the kind accent and a
  kind chip (icon + "Movie"/"Show"). For shows, the title cell gains a meta line —
  `N seasons · N episodes · genre · year` — plus the reserved, empty `S · E` slot (D-12). The three
  table implementations (personal, combined, solo) each need the kind swap; the combined table at
  `:555-856` is inline and does not use `ContentRow`.
- **Add form**: `AddMovieForm` → `AddContentForm` with a `kind` prop; placeholder "Add a show…",
  `SEARCH_TMDB_SHOWS`, `ADD_SHOW`, and the year column fed by `first_air_year`.
- **This or That**: `MovieCompareCard` takes `kind`; show cards display seasons/episodes/year and
  `created_by` in place of `director`, with the teal accent.
- **History**: same offset/limit pagination (`PAGE_SIZE = 25`), `WATCHED_SHOWS`.
- **Notification settings**: a `SHOW_ADD` row with label "New show added by a connection".

### 4.6 TMDB links

`https://www.themoviedb.org/movie/${tmdb_id}` is hardcoded in five places — `MovieRow.tsx:113`,
`MovieCard.tsx:75`, `Homepage.tsx:440`, `WatchHistory.tsx:172`, `WatchHistoryCard.tsx:31`. Extract
one helper `tmdbUrl(kind, id)` returning `/movie/` or `/tv/`.

### 4.7 Functional requirements

**FR-SHOW-020: Kind toggle.** While any kind-scoped view is active, when the user selects the other
kind, the system shall keep the current view, load that view's data for the new kind, update the URL
to the corresponding path, and persist the choice.

**FR-SHOW-021: Deep link.** When a user opens `/shows/history` directly or refreshes it, the system
shall render the Shows history with the Shows segment selected.

**FR-SHOW-022: Kind is always visible.** Every content row shall carry both the kind accent border
and a kind chip with icon and text, so kind is distinguishable without relying on color.

**FR-SHOW-023: Episode-progress chip.** Show rows shall render an `EpisodeProgressChip` **only when
`Show.episode_progress` is present**; when absent the chip renders nothing and its row collapses.
(Superseded during Phase 4 review: the original "always-visible empty `S · E` placeholder" from D-12
was dropped as clutter, per product decision — the reserve-the-concept intent stands, but not a
visible empty box.)

**Landed (issue #107, D-16–D-19).** `Show.episode_progress` is now populated: it derives to
`S{next_season} · E{next_episode}` when both household-shared progress columns are set. `ContentRow`/
`ContentCard` render a pencil affordance next to the chip (authenticated users only) that opens
`ShowProgressModal` to set or clear progress via the `setShowProgress(id, season, episode)` mutation.
In-progress shows sort to the top of the Shows queue (D-19). Movies are untouched — the editor and
ordering clause are show-only.

---

## Phase 5 — Kometa / MDBList / Plex export for shows

**Deliverable:** show collections reach Plex, without endangering movie collections.

### 5.1 Thread `kind` through the export

- `ExportOptions` gains `kind: Kind`; `LIST_KIND` (H-7) is deleted.
- `getOrCreateMdbList` / `findExistingMdbList` take `kind` explicitly.
- `getCombinedTmdbIds` / `getSoloTmdbIds` (H-8) select tables from the `Record<Kind, string>` maps:
  `movies`/`shows`, `user_movie_elo`/`user_show_elo`, `movie_interest`/`show_interest`, column
  `movie_id`/`show_id`.
- `ExportListResult.movieCount` → `itemCount`; audit metadata `totalMovies` → `totalItems` at all
  five sites (D-10). GraphQL `KometaListExportResult.movieCount` → `itemCount`, and the frontend
  selection at `queries.ts:215`.

### 5.2 Per-kind separation (D-8)

| Axis                        | Movies                                         | Shows                                        |
| --------------------------- | ---------------------------------------------- | -------------------------------------------- |
| MDBList list name           | `Alice & Bob` / `Just Alice`                   | `Alice & Bob — Shows` / `Just Alice — Shows` |
| `kometa_mdblist_lists.kind` | `'movie'`                                      | `'show'`                                     |
| Kometa YAML file            | `movienight.yml`                               | `movienight-shows.yml`                       |
| Kometa keys                 | `radarr_add_missing`, `radarr_search`          | `sonarr_add_missing`, `sonarr_search`        |
| Plex label                  | `MovieNight`                                   | `MovieNight Shows`                           |
| Plex section                | `PLEX_MOVIES_SECTION_ID` or `type === 'movie'` | `PLEX_SHOWS_SECTION_ID` or `type === 'show'` |

The `[DEV] ` prefix continues to apply to both, ahead of the name.

### 5.3 MDBList payload (H-4)

`addItems` / `removeItems` send `{ movies: [...] }` or `{ shows: [...] }` by kind; `getListItems`
reads the matching response field. `createList` needs no change — MDBList infers list type from its
items.

### 5.4 Plex client (H-5)

`resolveMoviesSectionId` → `resolveSectionId(plexUrl, token, sectionType: 'movie' | 'show')`.
`fetchPlexCollectionsByLabel` and `deletePlexCollection` are already kind-agnostic.

### 5.5 Reconciler safety (H-1)

`reconcilePlexCollections` takes the kind's label **and** the kind's section id, and deletes only
within that pair. Guard: if the resolved shows section id equals the movies section id, log a
warning and skip reconcile entirely rather than risk deleting the other kind's collections.

### 5.6 Scheduler (D-9, H-9)

`runKometaExportScheduled` runs `runKometaExport` once per kind, sequentially, and logs one
`KOMETA_SCHEDULE_EXPORT` audit entry per kind (with a `kind` field in the metadata). A failure in one
kind must not prevent the other from running. The single timer and the single `kometa_schedule` row
stay as they are.

### 5.7 Admin UI

`KometaExport.tsx` lists exported lists per kind, and the `kometaSchedule` query returns each list's
`kind` — which requires fixing H-6 first.

### 5.8 Functional requirements

**FR-SHOW-030: Kind-scoped lists.** The export shall maintain one MDBList list per
(list_type, ref_id, environment, kind), and shall never write a show tmdb_id into a movie list.

**FR-SHOW-031: Reconciler containment.** The Plex reconciler shall only consider collections that
carry the kind's own label within the kind's own library section.

**FR-SHOW-032: Empty list handling.** When a kind has no exportable ids for a given
connection/user, the behaviour shall match movies today: reuse and empty an existing list, or skip
creation entirely if no list is persisted.

---

## Testing

Per CLAUDE.md: every new backend function needs companion tests; every new resolver needs happy
path, auth/authz, and at least two error/edge cases. Backend thresholds are 80% statements/lines/
functions and 65% branches.

| Area           | New suite                                                                          | Must cover                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Show resolvers | `backend/src/__tests__/resolvers/show-resolvers.test.ts`                           | add/match/watched/unwatch/delete happy paths; unauthenticated; non-owner non-admin; missing id; title validation              |
| Show tags      | extend `tag-resolvers.test.ts`                                                     | upsert, remove, unknown slug, cross-user isolation                                                                            |
| Show Elo       | extend `elo.test.ts`                                                               | kind maps hit the right tables; movie path unchanged                                                                          |
| Pair selection | `pairSelection.test.ts`                                                            | rename only — assertions unchanged                                                                                            |
| Export         | extend `kometaExport.test.ts`                                                      | kind-scoped SQL; `sonarr_*` keys for shows; per-kind filename; reconciler never crosses labels/sections; shared-section guard |
| MDBList        | extend `mdblist.test.ts`                                                           | `shows` payload key; response field selection                                                                                 |
| Plex           | extend `plexClient.test.ts`                                                        | `sectionType` selection for both types; null when absent                                                                      |
| Frontend       | `src/utils/__tests__/paths.test.ts`, `src/contexts/__tests__/KindContext.test.tsx` | `parsePath` for every row in the 4.1 table incl. unknown paths; kind switch preserves view                                    |

**Regression guard:** movie-path tests must not be edited except for mechanical renames. A movie test
that needs a behavioural change means the refactor went wrong.

---

## Acceptance criteria

### AC-SHOW-001: Add and rank a show

```
Given a logged-in user on /shows with TMDB configured
When they add "Severance" and pick the TMDB match
Then the show appears in the Shows queue with poster, seasons, episodes and year
And it does not appear in the Movies queue
And the user's accepted connections receive a SHOW_ADD push (unless opted out)
```

### AC-SHOW-002: Elo pools stay separate

```
Given both queues contain items
When the user opens This or That with Shows selected
Then both cards are shows
And recording a pick writes to show_comparisons and user_show_elo only
And no row in movie_comparisons or user_movie_elo is touched
```

### AC-SHOW-003: Kind survives refresh and Back

```
Given the user is on /shows/history
When they refresh the page
Then the Shows history renders with the Shows segment selected
And pressing Back returns to the previously viewed path with its kind applied
```

### AC-SHOW-004: Export isolation

```
Given movie collections exist in Plex under the MovieNight label
When a shows export runs
Then a separate MDBList list, YAML file and Plex label are used
And every pre-existing movie collection still exists in Plex
```

### AC-SHOW-005: Movies are unchanged

```
Given a user who never opens the Shows toggle
When they use the app exactly as before
Then every movie flow behaves identically to the pre-shows build
And no movie query returns show rows
```

---

## Implementation order

1. **Phase 2** — backend surface + tests. Largest phase; nothing user-visible.
2. **Phase 3** — `ContentRow` rename. Small, mechanical, merge fast to avoid conflicts.
3. **Phase 4** — frontend. Depends on 2 and 3.
4. **Phase 5** — export. Independent of 3 and 4; can run in parallel with the frontend work.

Fix **H-6** (the three unscoped `kometa_mdblist_lists` selects) in whichever of Phase 2 or Phase 5
lands first — it is three lines and prevents a silent data-mixing bug. **Done in Phase 2:** extracted
to `fetchExportedLists(environment, kind='movie')` in `resolvers.ts`, filtering `AND kind = $2`.

---

## Open questions

1. **Plex library section.** Does the target Plex server have a separate TV library, and should
   `PLEX_SHOWS_SECTION_ID` be set explicitly rather than auto-resolved? Auto-resolve takes the
   _first_ `type === 'show'` directory, which is wrong if there are several.
2. **Sonarr.** `sonarr_add_missing` assumes Kometa is configured with a Sonarr instance. If it isn't,
   those keys should be omitted rather than emitted-and-ignored.
3. **MDBList show support.** The API accepts a `shows` array in the same payload shape, but this has
   not been verified against a live list. Worth a manual probe before building Phase 5 on it.
4. **`status` field.** TMDB returns values like `Returning Series` / `Ended`. Should ended shows be
   visually distinguished, or is the field stored-but-unused for now? Currently unused.

---

## Incidental findings (not blocking, worth fixing)

Turned up while reconstructing this spec. None are caused by the shows work.

1. **Dead dependencies.** `@dnd-kit/core`, `@dnd-kit/sortable` and `@dnd-kit/utilities`
   (`package.json:8-10`) are imported nowhere in `src/` — left behind when drag-to-rank was replaced
   by Elo. Three packages of dead weight in the frontend bundle.
2. **`CLAUDE.md` is stale.** It documents `reorderMovie(id, afterId)`, "Movies ordered by `rank`
   using fractional indexing", and `@dnd-kit` drag-and-drop as current features. None of that exists
   any more. It also predates the `shows` tables, `movie_interest`, `user_connections`, the push
   tables and the Elo tables, and its schema table lists neither. An agent reading it today is
   actively misled — it deserves a refresh pass of its own.
3. **`KometaSchedule.exportedLists` reports `movieCount: 0`** at all three sites
   (`resolvers.ts:296-301`, `:1167-1172`, `:1211-1216`) — the count is hardcoded, never real.
4. **`setMdblistApiKey` writes no audit entry** (`resolvers.ts:1175`), unlike every other admin
   mutation that changes configuration.
5. **Unused imports in `resolvers.ts`**: `fs`, `path` (`:1-2`), `createList`, `syncList` (`:16`).
6. **`movies.rank` is still written** on insert (`VALUES ($1,$2,0,$3)`) and recomputed in
   `unwatchMovie` (`:2165`) despite being unused for ordering — a column-drop migration would
   simplify the movie path and make it match `shows`.
