import {
  mockQuery,
  mockSelectPair,
  mockFetch,
  authContext,
  adminContext,
  anonContext,
} from './__helpers';
import { resolvers } from '../../resolvers';

const Query = resolvers.Query;

describe('Query.appInfo', () => {
  const origEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('non-production: returns isProduction=false with quickLoginUsers', () => {
    process.env.NODE_ENV = 'development';
    const result = Query.appInfo();
    expect(result.isProduction).toBe(false);
    expect(result.quickLoginUsers.length).toBeGreaterThan(0);
  });

  it('production: returns isProduction=true with empty quickLoginUsers', () => {
    process.env.NODE_ENV = 'production';
    const result = Query.appInfo();
    expect(result.isProduction).toBe(true);
    expect(result.quickLoginUsers).toEqual([]);
  });
});

describe('Query.me', () => {
  it('authenticated returns user data', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, username: 'alice' }] });
    const result = await Query.me(null, null, authContext());
    expect(result.username).toBe('alice');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(Query.me(null, null, anonContext())).rejects.toThrow('Not authenticated');
  });
});

describe('Query.users', () => {
  it('admin returns all users', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const result = await Query.users(null, null, adminContext());
    expect(result).toHaveLength(2);
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(Query.users(null, null, authContext())).rejects.toThrow('Not authorized');
  });
});

describe('Query.user', () => {
  it('admin returns user by ID', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, username: 'bob' }] });
    const result = await Query.user(null, { id: '5' }, adminContext());
    expect(result.username).toBe('bob');
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(Query.user(null, { id: '5' }, authContext())).rejects.toThrow('Not authorized');
  });
});

describe('Query.movie', () => {
  it('returns single movie by ID', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 3, title: 'Inception' }] });
    const result = await (Query.movie as any)(null, { id: '3' });
    expect(result.title).toBe('Inception');
  });
});

describe('Query.movies', () => {
  it('authenticated queries with user Elo join', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'A' }] });
    await Query.movies(null, null, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('user_movie_elo'), [1]);
  });

  it('unauthenticated queries global elo_rank', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'A' }] });
    await Query.movies(null, null, anonContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ORDER BY m.elo_rank'));
  });
});

describe('Query.auditLogs', () => {
  it('admin returns logs with capped limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await Query.auditLogs(null, { limit: 1000, offset: 0 }, adminContext());
    // Should cap at 500
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [500, 0]);
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(Query.auditLogs(null, { limit: 10, offset: 0 }, authContext())).rejects.toThrow(
      'Not authorized',
    );
  });
});

describe('Query.loginHistory', () => {
  it('admin with userId filter returns filtered results', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await Query.loginHistory(null, { userId: '5', limit: 50 }, adminContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE lh.user_id'), ['5', 50]);
  });

  it('admin without filter returns all', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await Query.loginHistory(null, { limit: 50 }, adminContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [50]);
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(Query.loginHistory(null, { limit: 10 }, authContext())).rejects.toThrow(
      'Not authorized',
    );
  });

  it('caps limit at 500', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await Query.loginHistory(null, { limit: 999 }, adminContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [500]);
  });
});

describe('Query.thisOrThat', () => {
  it('authenticated returns movieA and movieB', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, title: 'A', tmdb_id: null, user_comparison_count: '0', elo_rating: '1000' },
        { id: 2, title: 'B', tmdb_id: null, user_comparison_count: '0', elo_rating: '1000' },
      ],
    });
    mockSelectPair.mockReturnValue([
      { id: 1, title: 'A', tmdb_id: null, userComparisonCount: 0, elo_rating: 1000 },
      { id: 2, title: 'B', tmdb_id: null, userComparisonCount: 0, elo_rating: 1000 },
    ]);
    const result = await Query.thisOrThat(null, {}, authContext());
    expect(result.movieA.title).toBe('A');
    expect(result.movieB.title).toBe('B');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(Query.thisOrThat(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });

  it('less than 2 movies throws BAD_USER_INPUT', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'A', tmdb_id: null, user_comparison_count: '0', elo_rating: '1000' }],
    });
    // Retry without exclusion also returns < 2
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'A', tmdb_id: null, user_comparison_count: '0', elo_rating: '1000' }],
    });
    await expect(Query.thisOrThat(null, {}, authContext())).rejects.toThrow(
      'Add more movies to start comparing',
    );
  });
});

describe('Query.searchTmdb', () => {
  const origKey = process.env.TMDB_API_KEY;
  afterEach(() => {
    if (origKey) process.env.TMDB_API_KEY = origKey;
    else delete process.env.TMDB_API_KEY;
  });

  it('returns mapped TMDB results', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 1, title: 'Movie', release_date: '2024-01-01', overview: 'desc' }],
      }),
    });
    const result = await Query.searchTmdb(null, { query: 'Movie' }, authContext());
    expect(result).toHaveLength(1);
    expect(result[0].tmdb_id).toBe(1);
    expect(result[0].release_year).toBe('2024');
  });

  it('throws when no TMDB_API_KEY', async () => {
    delete process.env.TMDB_API_KEY;
    await expect(Query.searchTmdb(null, { query: 'X' }, authContext())).rejects.toThrow(
      'TMDB API key not configured',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    await expect(Query.searchTmdb(null, { query: 'Movie' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

describe('Query.myRankings', () => {
  it('authenticated returns user rankings', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'A', elo_rating: '1050', comparison_count: '10' }],
    });
    const result = await Query.myRankings(null, null, authContext());
    expect(result[0].eloRating).toBe(1050);
    expect(result[0].comparisonCount).toBe(10);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(Query.myRankings(null, null, anonContext())).rejects.toThrow('Not authenticated');
  });
});

describe('Query.searchUsers', () => {
  it('authenticated returns matching users', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 2, username: 'bob' }] });
    const result = await Query.searchUsers(null, { query: 'bob' }, authContext());
    expect(result[0].username).toBe('bob');
  });

  it('escapes SQL wildcard characters in query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await Query.searchUsers(null, { query: 'test%_\\' }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1, '%test\\%\\_\\\\%']);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(Query.searchUsers(null, { query: 'x' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

describe('Query.kometaSchedule', () => {
  it('admin returns schedule data', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          enabled: true,
          frequency: 'daily',
          daily_time: '03:00',
          collection_name: null,
          last_run_at: null,
        },
      ],
    });
    const result = await Query.kometaSchedule(null, null, adminContext());
    expect(result.enabled).toBe(true);
    expect(result.frequency).toBe('daily');
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(Query.kometaSchedule(null, null, authContext())).rejects.toThrow('Not authorized');
  });
});

describe('Query.combinedList', () => {
  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(Query.combinedList(null, { connectionId: '1' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('connection not found throws NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(Query.combinedList(null, { connectionId: '999' }, authContext())).rejects.toThrow(
      'Connection not found',
    );
  });
});
