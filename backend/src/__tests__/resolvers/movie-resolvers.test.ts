import {
  mockQuery,
  mockApplyComparison,
  mockUpdateGlobalEloRank,
  authContext,
  adminContext,
  anonContext,
} from './__helpers';
import { resolvers } from '../../resolvers';

const { addMovie, matchMovie, markWatched, deleteMovie, recordComparison, resetMovieComparisons } =
  resolvers.Mutation;

describe('Mutation.addMovie', () => {
  it('authenticated user can add a movie', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Inception', requested_by: 1 }] }) // INSERT
      .mockResolvedValueOnce({ rows: [{ username: 'alice', display_name: 'Alice' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await addMovie(null, { title: 'Inception' }, authContext());
    expect(result.title).toBe('Inception');
  });

  it('passes tmdb_id when provided', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Inception', tmdb_id: 27205 }] })
      .mockResolvedValueOnce({ rows: [{ username: 'a', display_name: null }] })
      .mockResolvedValueOnce({ rows: [] });
    await addMovie(null, { title: 'Inception', tmdb_id: 27205 }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO movies'), [
      'Inception',
      1,
      27205,
    ]);
  });

  it('trims whitespace from title', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Inception' }] })
      .mockResolvedValueOnce({ rows: [{ username: 'alice' }] })
      .mockResolvedValueOnce({ rows: [] });
    await addMovie(null, { title: '  Inception  ' }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO movies'), [
      'Inception',
      1,
      null,
    ]);
  });

  it('rejects empty title after trimming', async () => {
    await expect(addMovie(null, { title: '   ' }, authContext())).rejects.toThrow(
      'Title must be between 1 and 500 characters',
    );
  });

  it('rejects title exceeding 500 characters', async () => {
    await expect(addMovie(null, { title: 'A'.repeat(501) }, authContext())).rejects.toThrow(
      'Title must be between 1 and 500 characters',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(addMovie(null, { title: 'X' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

describe('Mutation.matchMovie', () => {
  it('owner can match their own movie', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: 1, requested_by: 1, title: 'Old', user_username: 'a', user_display_name: 'A' },
        ],
      }) // SELECT movie
      .mockResolvedValueOnce({
        rows: [{ id: 1, tmdb_id: 100, title: 'New' }],
      }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await matchMovie(
      null,
      { id: '1', tmdb_id: 100, title: 'New' },
      authContext({ userId: 1 }),
    );
    expect(result.title).toBe('New');
  });

  it('admin can match any movie', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: 1, requested_by: 99, title: 'Old', user_username: 'x', user_display_name: null },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 1, tmdb_id: 100, title: 'New' }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await matchMovie(null, { id: '1', tmdb_id: 100, title: 'New' }, adminContext());
    expect(result.title).toBe('New');
  });

  it('non-owner non-admin throws FORBIDDEN', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, requested_by: 99, title: 'X' }],
    });
    await expect(
      matchMovie(null, { id: '1', tmdb_id: 1, title: 'X' }, authContext({ userId: 2 })),
    ).rejects.toThrow('Not authorized');
  });

  it('nonexistent movie throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      matchMovie(null, { id: '999', tmdb_id: 1, title: 'X' }, authContext()),
    ).rejects.toThrow('Movie not found');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      matchMovie(null, { id: '1', tmdb_id: 1, title: 'X' }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

describe('Mutation.markWatched', () => {
  it('owner can mark their movie watched', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, requested_by: 1 }] }) // SELECT
      .mockResolvedValueOnce({
        rows: [{ id: 1, title: 'M', requested_by: 1, watched_at: new Date() }],
      }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ username: 'a', display_name: 'A' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await markWatched(null, { id: '1' }, authContext({ userId: 1 }));
    expect(result.watched_at).toBeTruthy();
  });

  it('admin can mark any movie watched', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, requested_by: 99 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, title: 'M', requested_by: 99, watched_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [{ username: 'x', display_name: null }] })
      .mockResolvedValueOnce({ rows: [] });
    await markWatched(null, { id: '1' }, adminContext());
  });

  it('non-owner non-admin throws FORBIDDEN', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, requested_by: 99 }] });
    await expect(markWatched(null, { id: '1' }, authContext({ userId: 2 }))).rejects.toThrow(
      'Not authorized',
    );
  });

  it('nonexistent movie throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(markWatched(null, { id: '999' }, authContext())).rejects.toThrow(
      'Movie not found',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(markWatched(null, { id: '1' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

describe('Mutation.deleteMovie', () => {
  it('admin can delete a movie', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ title: 'Deleted' }] }) // SELECT title
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // DELETE
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await deleteMovie(null, { id: '1' }, adminContext());
    expect(result).toBe(true);
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(deleteMovie(null, { id: '1' }, authContext())).rejects.toThrow('Not authorized');
  });

  it('returns false when movie does not exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT (not found)
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }); // DELETE
    const result = await deleteMovie(null, { id: '999' }, adminContext());
    expect(result).toBe(false);
  });
});

describe('Mutation.recordComparison', () => {
  it('authenticated user records comparison', async () => {
    mockApplyComparison.mockResolvedValue({ winnerElo: 1016, loserElo: 984 });
    mockQuery.mockResolvedValue({ rows: [] }); // logAudit
    const result = await recordComparison(null, { winnerId: '1', loserId: '2' }, authContext());
    expect(result.winnerElo).toBe(1016);
    expect(result.loserElo).toBe(984);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      recordComparison(null, { winnerId: '1', loserId: '2' }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

describe('Mutation.resetMovieComparisons', () => {
  it('authenticated user resets comparisons for a movie', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5, title: 'Test' }] }) // SELECT movie
      .mockResolvedValueOnce({ rows: [] }) // DELETE comparisons
      .mockResolvedValueOnce({ rows: [] }) // DELETE elo entry
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    mockUpdateGlobalEloRank.mockResolvedValue(undefined);
    const result = await resetMovieComparisons(null, { movieId: '5' }, authContext());
    expect(result).toBe(true);
  });

  it('nonexistent movie throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(resetMovieComparisons(null, { movieId: '999' }, authContext())).rejects.toThrow(
      'Movie not found',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(resetMovieComparisons(null, { movieId: '5' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});
