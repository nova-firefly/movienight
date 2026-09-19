import {
  mockQuery,
  mockApplyComparison,
  mockUpdateGlobalEloRank,
  mockSelectPair,
  mockSendPushToConnectionsOf,
  mockFetch,
  authContext,
  adminContext,
  anonContext,
} from './__helpers';
import { resolvers } from '../../resolvers';

const {
  addShow,
  matchShow,
  markShowWatched,
  unwatchShow,
  deleteShow,
  recordShowComparison,
  resetShowComparisons,
  setShowInterest,
  setShowTag,
  removeShowTag,
  setShowProgress,
  backfillShowTmdbData,
} = resolvers.Mutation as any;
const {
  shows,
  show,
  searchTmdbShows,
  showThisOrThat,
  myShowRankings,
  combinedShowList,
  newShowsFromConnections,
  soloShows,
  passedShowIds,
  watchedShows,
} = resolvers.Query as any;
const { requester, created_by, networks, myTags, userTags, episode_progress } =
  resolvers.Show as any;

beforeEach(() => {
  mockQuery.mockReset();
});

// ── Query.shows ────────────────────────────────────────────────────────────

describe('Query.shows', () => {
  it('authenticated orders in-progress first, then by personal Elo', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Severance' }] });
    const result = await shows(null, {}, authContext());
    expect(result).toHaveLength(1);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('FROM shows');
    expect(sql).toContain('user_show_elo');
    // In-progress shows (next_season set) sort above ranked ones (D-19).
    expect(sql).toContain('ORDER BY (s.next_season IS NOT NULL) DESC');
    expect(sql).toContain('use.elo_rating DESC NULLS LAST');
    expect(sql).toContain('s.next_season, s.next_episode');
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1]);
  });

  it('anonymous orders in-progress first, then by global elo_rank', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await shows(null, {}, anonContext());
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY (s.next_season IS NOT NULL) DESC');
    expect(sql).toContain('s.elo_rank DESC NULLS LAST');
    expect(sql).not.toContain('user_show_elo');
  });
});

describe('Query.show', () => {
  it('returns the show by id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, title: 'Andor' }] });
    const result = await show(null, { id: '5' });
    expect(result.title).toBe('Andor');
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM shows'), ['5']);
  });
});

// ── Query.searchTmdbShows ────────────────────────────────────────────────────

describe('Query.searchTmdbShows', () => {
  const origKey = process.env.TMDB_API_KEY;
  afterEach(() => {
    if (origKey) process.env.TMDB_API_KEY = origKey;
    else delete process.env.TMDB_API_KEY;
  });

  it('maps first_air_year from the TV search results', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 42, name: 'Severance', first_air_date: '2022-02-18', overview: 'desc' }],
      }),
    });
    const result = await searchTmdbShows(null, { query: 'Severance' }, authContext());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      tmdb_id: 42,
      title: 'Severance',
      first_air_year: '2022',
      overview: 'desc',
    });
  });

  it('throws when no TMDB_API_KEY', async () => {
    delete process.env.TMDB_API_KEY;
    await expect(searchTmdbShows(null, { query: 'X' }, authContext())).rejects.toThrow(
      'TMDB API key not configured',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    await expect(searchTmdbShows(null, { query: 'X' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

// ── Query.showThisOrThat ─────────────────────────────────────────────────────

describe('Query.showThisOrThat', () => {
  it('returns a pair of shows', async () => {
    const rows = [
      { id: 1, title: 'A', tmdb_id: null, user_comparison_count: 0, elo_rating: 1000 },
      { id: 2, title: 'B', tmdb_id: null, user_comparison_count: 0, elo_rating: 1000 },
    ];
    mockQuery.mockResolvedValueOnce({ rows });
    mockSelectPair.mockReturnValueOnce([
      { id: 1, title: 'A', tmdb_id: null, userComparisonCount: 0, elo_rating: 1000 },
      { id: 2, title: 'B', tmdb_id: null, userComparisonCount: 0, elo_rating: 1000 },
    ]);
    const result = await showThisOrThat(null, {}, authContext());
    expect(result.showA.id).toBe('1');
    expect(result.showB.id).toBe('2');
    expect(result.showA.created_by).toEqual([]);
    expect(result.showA.networks).toEqual([]);
  });

  it('throws BAD_USER_INPUT when fewer than two shows exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // with exclusion
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // retry without exclusion
    await expect(showThisOrThat(null, {}, authContext())).rejects.toThrow(
      'Add more shows to start comparing',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(showThisOrThat(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });
});

// ── Query.myShowRankings ─────────────────────────────────────────────────────

describe('Query.myShowRankings', () => {
  it('returns rankings with elo + comparison count', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'A', elo_rating: '1050', comparison_count: '7' }],
    });
    const result = await myShowRankings(null, {}, authContext());
    expect(result[0].eloRating).toBe(1050);
    expect(result[0].comparisonCount).toBe(7);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(myShowRankings(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });
});

// ── Query.combinedShowList ───────────────────────────────────────────────────

describe('Query.combinedShowList', () => {
  it('returns rankings for an accepted connection', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            requester_id: 1,
            addressee_id: 2,
            status: 'accepted',
            created_at: new Date(),
            other_user_id: 2,
            username: 'bob',
            display_name: 'Bob',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'A',
            user_a_elo: '1100',
            user_b_elo: '900',
            combined_elo: '1000',
            both_rated: true,
          },
        ],
      });
    const result = await combinedShowList(null, { connectionId: '3' }, authContext({ userId: 1 }));
    expect(result.connection.user.username).toBe('bob');
    expect(result.rankings[0].combinedElo).toBe(1000);
    expect(result.rankings[0].bothRated).toBe(true);
  });

  it('throws NOT_FOUND when connection is not accepted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      combinedShowList(null, { connectionId: '9' }, authContext({ userId: 1 })),
    ).rejects.toThrow('Connection not found or not accepted');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(combinedShowList(null, { connectionId: '3' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

// ── Query.newShowsFromConnections / soloShows / passedShowIds ─────────────────

describe('Query.newShowsFromConnections', () => {
  it('returns shows added by connections with adder info', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'A', adder_id: 2, adder_username: 'bob', adder_display_name: 'Bob' }],
    });
    const result = await newShowsFromConnections(null, {}, authContext({ userId: 1 }));
    expect(result[0].addedBy.username).toBe('bob');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(newShowsFromConnections(null, {}, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

describe('Query.soloShows', () => {
  it('returns solo shows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'A' }] });
    const result = await soloShows(null, {}, authContext());
    expect(result).toHaveLength(1);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(soloShows(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });
});

describe('Query.passedShowIds', () => {
  it('returns stringified show ids', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ show_id: 4 }, { show_id: 7 }] });
    const result = await passedShowIds(null, {}, authContext());
    expect(result).toEqual(['4', '7']);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(passedShowIds(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });
});

describe('Query.watchedShows', () => {
  it('returns watched shows and clamps limit/offset', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'A' }] });
    await watchedShows(null, { limit: 10, offset: 5 }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1 OFFSET $2'), [10, 5]);
  });

  it('defaults limit to 50 and clamps out-of-range', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await watchedShows(null, { limit: 9999, offset: -3 }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [200, 0]);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(watchedShows(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.addShow ─────────────────────────────────────────────────────────

describe('Mutation.addShow', () => {
  it('authenticated user can add a show and fans out a SHOW_ADD push', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Severance', requested_by: 1 }] }) // INSERT
      .mockResolvedValueOnce({ rows: [{ username: 'alice', display_name: 'Alice' }] }) // user
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await addShow(null, { title: 'Severance' }, authContext());
    expect(result.title).toBe('Severance');
    expect(mockSendPushToConnectionsOf).toHaveBeenCalledWith(
      1,
      'SHOW_ADD',
      expect.objectContaining({ url: '/shows' }),
    );
  });

  it('passes tmdb_id and inserts without a rank column', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Severance', tmdb_id: 95396 }] })
      .mockResolvedValueOnce({ rows: [{ username: 'a', display_name: null }] })
      .mockResolvedValueOnce({ rows: [] });
    await addShow(null, { title: 'Severance', tmdb_id: 95396 }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO shows (title, requested_by, tmdb_id) VALUES ($1, $2, $3) RETURNING *',
      ['Severance', 1, 95396],
    );
  });

  it('trims whitespace from the title', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Severance' }] })
      .mockResolvedValueOnce({ rows: [{ username: 'a' }] })
      .mockResolvedValueOnce({ rows: [] });
    await addShow(null, { title: '  Severance  ' }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO shows'), [
      'Severance',
      1,
      null,
    ]);
  });

  it('rejects empty title after trimming', async () => {
    await expect(addShow(null, { title: '   ' }, authContext())).rejects.toThrow(
      'Title must be between 1 and 500 characters',
    );
  });

  it('rejects title exceeding 500 characters', async () => {
    await expect(addShow(null, { title: 'A'.repeat(501) }, authContext())).rejects.toThrow(
      'Title must be between 1 and 500 characters',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(addShow(null, { title: 'X' }, anonContext())).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.matchShow ───────────────────────────────────────────────────────

describe('Mutation.matchShow', () => {
  it('owner can match their show', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'old', requested_by: 1 }] }) // SELECT
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'New', tmdb_id: 5 }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await matchShow(
      null,
      { id: '1', tmdb_id: 5, title: 'New' },
      authContext({ userId: 1 }),
    );
    expect(result.title).toBe('New');
  });

  it('admin can match any show', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'old', requested_by: 99 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'New' }] })
      .mockResolvedValueOnce({ rows: [] });
    await matchShow(null, { id: '1', tmdb_id: 5, title: 'New' }, adminContext());
  });

  it('non-owner non-admin throws FORBIDDEN', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'old', requested_by: 99 }] });
    await expect(
      matchShow(null, { id: '1', tmdb_id: 5, title: 'New' }, authContext({ userId: 2 })),
    ).rejects.toThrow('Not authorized');
  });

  it('nonexistent show throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      matchShow(null, { id: '999', tmdb_id: 5, title: 'New' }, authContext()),
    ).rejects.toThrow('Show not found');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      matchShow(null, { id: '1', tmdb_id: 5, title: 'New' }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.markShowWatched ─────────────────────────────────────────────────

describe('Mutation.markShowWatched', () => {
  it('owner can mark their show watched', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, requested_by: 1 }] }) // SELECT
      .mockResolvedValueOnce({
        rows: [{ id: 1, title: 'S', requested_by: 1, watched_at: new Date() }],
      }) // UPDATE (updateWatchedState)
      .mockResolvedValueOnce({ rows: [{ username: 'a', display_name: 'A' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await markShowWatched(null, { id: '1' }, authContext({ userId: 1 }));
    expect(result.watched_at).toBeTruthy();
  });

  it('non-owner with accepted connection can mark watched', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, requested_by: 99 }] }) // SELECT
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // connection lookup → exists
      .mockResolvedValueOnce({
        rows: [{ id: 1, title: 'S', requested_by: 99, watched_at: new Date() }],
      }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ username: 'x', display_name: null }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await markShowWatched(null, { id: '1' }, authContext({ userId: 2 }));
    expect(result.watched_at).toBeTruthy();
  });

  it('non-owner without connection throws FORBIDDEN', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, requested_by: 99 }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }); // connection lookup → none
    await expect(markShowWatched(null, { id: '1' }, authContext({ userId: 2 }))).rejects.toThrow(
      'Not authorized',
    );
  });

  it('nonexistent show throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(markShowWatched(null, { id: '999' }, authContext())).rejects.toThrow(
      'Show not found',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(markShowWatched(null, { id: '1' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

// ── Mutation.unwatchShow ─────────────────────────────────────────────────────

describe('Mutation.unwatchShow', () => {
  it('owner can requeue a watched show (no rank recompute)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, requested_by: 1, watched_at: new Date() }] }) // SELECT
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'S', requested_by: 1, watched_at: null }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ username: 'a', display_name: 'A' }] }); // user lookup
    const result = await unwatchShow(null, { id: '1' }, authContext({ userId: 1 }));
    expect(result.watched_at).toBeNull();
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain('watched_at = NULL');
    expect(updateSql).not.toContain('rank');
  });

  it('throws BAD_USER_INPUT when the show is not watched', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, requested_by: 1, watched_at: null }] });
    await expect(unwatchShow(null, { id: '1' }, authContext({ userId: 1 }))).rejects.toThrow(
      'Show is not marked as watched',
    );
  });

  it('non-owner non-admin throws FORBIDDEN', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, requested_by: 99, watched_at: new Date() }],
    });
    await expect(unwatchShow(null, { id: '1' }, authContext({ userId: 2 }))).rejects.toThrow(
      'Not authorized',
    );
  });

  it('nonexistent show throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(unwatchShow(null, { id: '999' }, authContext())).rejects.toThrow('Show not found');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(unwatchShow(null, { id: '1' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

// ── Mutation.deleteShow ──────────────────────────────────────────────────────

describe('Mutation.deleteShow', () => {
  it('admin can delete a show', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ title: 'S' }] }) // SELECT title
      .mockResolvedValueOnce({ rowCount: 1 }) // DELETE
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await deleteShow(null, { id: '1' }, adminContext());
    expect(result).toBe(true);
  });

  it('returns false when the show does not exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT title
      .mockResolvedValueOnce({ rowCount: 0 }); // DELETE
    const result = await deleteShow(null, { id: '999' }, adminContext());
    expect(result).toBe(false);
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(deleteShow(null, { id: '1' }, authContext())).rejects.toThrow('Not authorized');
  });
});

// ── Mutation.recordShowComparison ────────────────────────────────────────────

describe('Mutation.recordShowComparison', () => {
  it('applies a comparison against the show pool', async () => {
    mockApplyComparison.mockResolvedValueOnce({ winnerElo: 1016, loserElo: 984 });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await recordShowComparison(
      null,
      { winnerId: '10', loserId: '20' },
      authContext(),
    );
    expect(result.winnerElo).toBe(1016);
    expect(mockApplyComparison).toHaveBeenCalledWith('show', 1, 10, 20);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      recordShowComparison(null, { winnerId: '1', loserId: '2' }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.resetShowComparisons ────────────────────────────────────────────

describe('Mutation.resetShowComparisons', () => {
  it('deletes show comparisons + elo and recomputes rank', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'S' }] }) // SELECT show
      .mockResolvedValueOnce({ rows: [] }) // DELETE show_comparisons
      .mockResolvedValueOnce({ rows: [] }) // DELETE user_show_elo
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await resetShowComparisons(null, { showId: '1' }, authContext());
    expect(result).toBe(true);
    expect(mockUpdateGlobalEloRank).toHaveBeenCalledWith('show', 1);
    const delCompSql = mockQuery.mock.calls[1][0] as string;
    expect(delCompSql).toContain('show_comparisons');
  });

  it('throws NOT_FOUND for a missing show', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(resetShowComparisons(null, { showId: '9' }, authContext())).rejects.toThrow(
      'Show not found',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(resetShowComparisons(null, { showId: '1' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

// ── Mutation.setShowInterest ─────────────────────────────────────────────────

describe('Mutation.setShowInterest', () => {
  it('upserts interest on the show_interest table', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'S' }] }) // show check
      .mockResolvedValueOnce({ rows: [] }) // setInterest upsert
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await setShowInterest(null, { showId: '1', interested: false }, authContext());
    expect(result).toEqual({ showId: '1', interested: false });
    const upsertSql = mockQuery.mock.calls[1][0] as string;
    expect(upsertSql).toContain('INSERT INTO show_interest');
    expect(upsertSql).toContain('show_id');
  });

  it('throws NOT_FOUND when the show is missing or watched', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      setShowInterest(null, { showId: '9', interested: true }, authContext()),
    ).rejects.toThrow('Show not found or already watched');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      setShowInterest(null, { showId: '1', interested: true }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.setShowTag / removeShowTag ──────────────────────────────────────

describe('Mutation.setShowTag', () => {
  it('upserts a per-user tag on the show', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 3, slug: 'seen', label: 'Seen it', value_type: 'boolean' }],
      }) // tag lookup
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'S' }] }) // show lookup
      .mockResolvedValueOnce({ rows: [{ id: 7, value: null, created_at: new Date() }] }) // upsertTag
      .mockResolvedValueOnce({ rows: [{ id: 1, username: 'a', display_name: 'A' }] }) // user
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await setShowTag(null, { showId: '1', tagSlug: 'seen' }, authContext());
    expect(result.tag.slug).toBe('seen');
    const upsertSql = mockQuery.mock.calls[2][0] as string;
    expect(upsertSql).toContain('INSERT INTO show_user_tags');
  });

  it('throws NOT_FOUND for an unknown tag slug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(setShowTag(null, { showId: '1', tagSlug: 'nope' }, authContext())).rejects.toThrow(
      'Tag not found',
    );
  });

  it('throws NOT_FOUND for a missing show', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 3, slug: 'seen', value_type: 'boolean' }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(setShowTag(null, { showId: '9', tagSlug: 'seen' }, authContext())).rejects.toThrow(
      'Show not found',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(setShowTag(null, { showId: '1', tagSlug: 'seen' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

describe('Mutation.removeShowTag', () => {
  it('removes an existing tag and returns true', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // tag lookup
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'S' }] }) // show lookup
      .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // removeTag delete
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await removeShowTag(null, { showId: '1', tagSlug: 'seen' }, authContext());
    expect(result).toBe(true);
  });

  it('returns false for an unknown tag slug (no-op)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await removeShowTag(null, { showId: '1', tagSlug: 'nope' }, authContext());
    expect(result).toBe(false);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      removeShowTag(null, { showId: '1', tagSlug: 'seen' }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.setShowProgress ─────────────────────────────────────────────────

describe('Mutation.setShowProgress', () => {
  it('owner sets season + episode and stamps progress_updated_at', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Severance', requested_by: 1 }] }) // SELECT
      .mockResolvedValueOnce({
        rows: [{ id: 1, requested_by: 1, next_season: 2, next_episode: 4 }],
      }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ username: 'a', display_name: 'A' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await setShowProgress(
      null,
      { id: '1', season: 2, episode: 4 },
      authContext({ userId: 1 }),
    );
    expect(result.next_season).toBe(2);
    expect(result.next_episode).toBe(4);
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain('UPDATE shows');
    expect(mockQuery.mock.calls[1][1]).toEqual(['1', 2, 4]);
  });

  it('clears progress when season and episode are omitted', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Severance', requested_by: 1 }] }) // SELECT
      .mockResolvedValueOnce({
        rows: [{ id: 1, requested_by: 1, next_season: null, next_episode: null }],
      }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ username: 'a', display_name: 'A' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await setShowProgress(null, { id: '1' }, authContext({ userId: 1 }));
    expect(result.next_season).toBeNull();
    expect(mockQuery.mock.calls[1][1]).toEqual(['1', null, null]);
  });

  it('accepted connection of the owner can set progress (shared/household)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'S', requested_by: 99 }] }) // SELECT
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // connection lookup → exists
      .mockResolvedValueOnce({
        rows: [{ id: 1, requested_by: 99, next_season: 1, next_episode: 1 }],
      }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ username: 'x', display_name: null }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await setShowProgress(
      null,
      { id: '1', season: 1, episode: 1 },
      authContext({ userId: 2 }),
    );
    expect(result.next_season).toBe(1);
  });

  it('throws BAD_USER_INPUT for a partial pair (season without episode)', async () => {
    await expect(
      setShowProgress(null, { id: '1', season: 2 }, authContext({ userId: 1 })),
    ).rejects.toThrow('Provide both season and episode');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('throws BAD_USER_INPUT for a non-positive season', async () => {
    await expect(
      setShowProgress(null, { id: '1', season: 0, episode: 1 }, authContext({ userId: 1 })),
    ).rejects.toThrow('Season must be a positive integer');
  });

  it('non-owner without connection throws FORBIDDEN', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'S', requested_by: 99 }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }); // connection lookup → none
    await expect(
      setShowProgress(null, { id: '1', season: 2, episode: 4 }, authContext({ userId: 2 })),
    ).rejects.toThrow('Not authorized');
  });

  it('nonexistent show throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      setShowProgress(null, { id: '999', season: 1, episode: 1 }, authContext({ userId: 1 })),
    ).rejects.toThrow('Show not found');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      setShowProgress(null, { id: '1', season: 1, episode: 1 }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.backfillShowTmdbData ────────────────────────────────────────────

describe('Mutation.backfillShowTmdbData', () => {
  it('admin backfills shows missing metadata', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, tmdb_id: 10 },
        { id: 2, tmdb_id: 20 },
      ],
    });
    const count = await backfillShowTmdbData(null, {}, adminContext());
    expect(count).toBe(2);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('FROM shows');
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(backfillShowTmdbData(null, {}, authContext())).rejects.toThrow('Not authorized');
  });
});

// ── Show field resolvers ─────────────────────────────────────────────────────

describe('Show field resolvers', () => {
  it('requester resolves from the requested_by join only', () => {
    expect(requester({ user_display_name: 'Alice', user_username: 'alice' })).toBe('Alice');
    expect(requester({ user_display_name: null, user_username: 'bob' })).toBe('bob');
    expect(requester({ user_display_name: null, user_username: null })).toBe('Unknown');
  });

  it('created_by / networks coalesce null to empty arrays', () => {
    expect(created_by({ created_by: null })).toEqual([]);
    expect(created_by({ created_by: ['Dan Erickson'] })).toEqual(['Dan Erickson']);
    expect(networks({ networks: null })).toEqual([]);
    expect(networks({ networks: ['Apple TV+'] })).toEqual(['Apple TV+']);
  });

  it('episode_progress derives "S · E" only when both columns are set', () => {
    expect(episode_progress({ next_season: 2, next_episode: 4 })).toBe('S2 · E4');
    expect(episode_progress({ next_season: null, next_episode: null })).toBeNull();
    expect(episode_progress({ next_season: 2, next_episode: null })).toBeNull();
    expect(episode_progress({ next_season: null, next_episode: 4 })).toBeNull();
  });

  it('myTags returns [] for an anonymous caller without querying', async () => {
    const result = await myTags({ id: 1 }, {}, anonContext());
    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('myTags queries show_user_tags for an authenticated caller', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          tag_id: 3,
          slug: 'seen',
          label: 'Seen it',
          value_type: 'boolean',
          uid: 1,
          username: 'a',
          display_name: 'A',
          value: null,
          created_at: new Date(),
        },
      ],
    });
    const result = await myTags({ id: 1 }, {}, authContext());
    expect(result[0].tag.slug).toBe('seen');
    expect(mockQuery.mock.calls[0][0] as string).toContain('FROM show_user_tags');
  });

  it('userTags returns all users tags on the show', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          tag_id: 3,
          slug: 'seen',
          label: 'Seen it',
          value_type: 'boolean',
          uid: 2,
          username: 'b',
          display_name: 'B',
          value: null,
          created_at: new Date(),
        },
      ],
    });
    const result = await userTags({ id: 1 });
    expect(result[0].user.username).toBe('b');
  });
});
