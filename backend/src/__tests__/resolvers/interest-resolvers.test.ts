import { mockQuery, authContext, anonContext } from './__helpers';
import { resolvers } from '../../resolvers';

const { setMovieInterest } = resolvers.Mutation;
const { newMoviesFromConnections, soloMovies } = resolvers.Query;

beforeEach(() => {
  mockQuery.mockReset();
});

// ── Query.newMoviesFromConnections ───────────────────────────────────────────

describe('Query.newMoviesFromConnections', () => {
  it('returns movies from connected users that have not been voted on', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          title: 'Inception',
          requested_by: 2,
          date_submitted: new Date('2024-06-01'),
          rank: 0,
          tmdb_id: 27205,
          watched_at: null,
          elo_rank: null,
          adder_id: 2,
          adder_username: 'bob',
          adder_display_name: 'Bob',
        },
      ],
    });
    const result = await newMoviesFromConnections(null, {}, authContext({ userId: 1 }));
    expect(result).toHaveLength(1);
    expect(result[0].movie.title).toBe('Inception');
    expect(result[0].addedBy.username).toBe('bob');
    expect(result[0].addedBy.display_name).toBe('Bob');
  });

  it('returns empty array when no pending movies', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await newMoviesFromConnections(null, {}, authContext());
    expect(result).toHaveLength(0);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(newMoviesFromConnections(null, {}, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('returns multiple movies from different connections', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          title: 'Inception',
          requested_by: 2,
          date_submitted: new Date('2024-06-01'),
          rank: 0,
          tmdb_id: null,
          watched_at: null,
          elo_rank: null,
          adder_id: 2,
          adder_username: 'bob',
          adder_display_name: null,
        },
        {
          id: 8,
          title: 'Arrival',
          requested_by: 3,
          date_submitted: new Date('2024-06-02'),
          rank: 0,
          tmdb_id: null,
          watched_at: null,
          elo_rank: null,
          adder_id: 3,
          adder_username: 'carol',
          adder_display_name: 'Carol',
        },
      ],
    });
    const result = await newMoviesFromConnections(null, {}, authContext({ userId: 1 }));
    expect(result).toHaveLength(2);
    expect(result[0].addedBy.username).toBe('bob');
    expect(result[1].addedBy.username).toBe('carol');
  });
});

// ── Mutation.setMovieInterest ────────────────────────────────────────────────

describe('Mutation.setMovieInterest', () => {
  it('sets interested = true for a valid movie', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5, title: 'Inception' }] }) // movie check
      .mockResolvedValueOnce({ rows: [] }) // UPSERT
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await setMovieInterest(
      null,
      { movieId: '5', interested: true },
      authContext({ userId: 1 }),
    );
    expect(result.movieId).toBe('5');
    expect(result.interested).toBe(true);
  });

  it('sets interested = false (pass)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5, title: 'Inception' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await setMovieInterest(
      null,
      { movieId: '5', interested: false },
      authContext({ userId: 1 }),
    );
    expect(result.movieId).toBe('5');
    expect(result.interested).toBe(false);
  });

  it('throws NOT_FOUND for nonexistent movie', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      setMovieInterest(null, { movieId: '999', interested: true }, authContext()),
    ).rejects.toThrow('Movie not found or already watched');
  });

  it('throws NOT_FOUND for already-watched movie', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // watched_at IS NULL filter excludes it
    await expect(
      setMovieInterest(null, { movieId: '5', interested: true }, authContext()),
    ).rejects.toThrow('Movie not found or already watched');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      setMovieInterest(null, { movieId: '5', interested: true }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });

  it('uses UPSERT with ON CONFLICT for repeated calls', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5, title: 'Inception' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    await setMovieInterest(null, { movieId: '5', interested: false }, authContext({ userId: 1 }));
    const upsertCall = mockQuery.mock.calls[1][0];
    expect(upsertCall).toContain('ON CONFLICT');
    expect(upsertCall).toContain('DO UPDATE SET');
  });

  it('logs audit with correct action and metadata', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5, title: 'Inception' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    await setMovieInterest(null, { movieId: '5', interested: true }, authContext({ userId: 1 }));
    // logAudit is the 3rd call
    const auditCall = mockQuery.mock.calls[2];
    const sql = auditCall[0];
    const params = auditCall[1];
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(params[1]).toBe('MOVIE_INTEREST_SET');
    expect(params[3]).toBe('5');
  });
});

// ── Query.soloMovies ─────────────────────────────────────────────────────────

describe('Query.soloMovies', () => {
  it('returns movies where all connections passed', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          title: 'Solo Film',
          requested_by: 1,
          date_submitted: new Date('2024-05-01'),
          rank: 0,
          tmdb_id: null,
          watched_at: null,
          elo_rank: null,
        },
      ],
    });
    const result = await soloMovies(null, {}, authContext({ userId: 1 }));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Solo Film');
  });

  it('returns empty when no solo movies', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await soloMovies(null, {}, authContext());
    expect(result).toHaveLength(0);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(soloMovies(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });

  it('uses CTE with my_connections for relational division', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await soloMovies(null, {}, authContext({ userId: 1 }));
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('my_connections');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('interested = false');
  });
});
