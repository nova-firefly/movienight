const mockQuery = jest.fn();
jest.mock('../db', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

import { searchTmdb, fetchTmdbMetadata, fetchAndStoreTmdbData, isTmdbConfigured } from '../tmdb';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

const ORIGINAL_KEY = process.env.TMDB_API_KEY;

beforeEach(() => {
  mockFetch.mockReset();
  mockQuery.mockReset();
  process.env.TMDB_API_KEY = 'test-key';
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.TMDB_API_KEY;
  else process.env.TMDB_API_KEY = ORIGINAL_KEY;
});

describe('isTmdbConfigured', () => {
  it('true when TMDB_API_KEY set', () => {
    expect(isTmdbConfigured()).toBe(true);
  });

  it('false when TMDB_API_KEY unset', () => {
    delete process.env.TMDB_API_KEY;
    expect(isTmdbConfigured()).toBe(false);
  });
});

describe('searchTmdb', () => {
  it('hits /search/movie for kind=movie and maps title + release_year', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          { id: 1, title: 'Inception', release_date: '2010-07-16', overview: 'Dream heist.' },
        ],
      }),
    );

    const result = await searchTmdb('movie', 'Inception');

    expect(result).toEqual([
      { tmdb_id: 1, title: 'Inception', release_year: '2010', overview: 'Dream heist.' },
    ]);
    expect(mockFetch.mock.calls[0][0]).toContain('/search/movie');
    expect(mockFetch.mock.calls[0][0]).toContain('query=Inception');
  });

  it('hits /search/tv for kind=show and maps name + first_air_date', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          { id: 42, name: 'Severance', first_air_date: '2022-02-18', overview: 'Split minds.' },
        ],
      }),
    );

    const result = await searchTmdb('show', 'Severance');

    expect(result).toEqual([
      { tmdb_id: 42, title: 'Severance', release_year: '2022', overview: 'Split minds.' },
    ]);
    expect(mockFetch.mock.calls[0][0]).toContain('/search/tv');
  });

  it('encodes the query string', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));
    await searchTmdb('movie', 'Star Wars: The Force Awakens');
    expect(mockFetch.mock.calls[0][0]).toContain('query=Star%20Wars%3A%20The%20Force%20Awakens');
  });

  it('caps at 10 results', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      title: `M${i}`,
      release_date: '2020-01-01',
      overview: '',
    }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: rows }));
    const result = await searchTmdb('movie', 'x');
    expect(result).toHaveLength(10);
  });

  it('throws when TMDB_API_KEY is unset', async () => {
    delete process.env.TMDB_API_KEY;
    await expect(searchTmdb('movie', 'x')).rejects.toThrow(/not configured/);
  });

  it('throws when TMDB responds non-2xx', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 500));
    await expect(searchTmdb('movie', 'x')).rejects.toThrow(/TMDB search failed \(500\)/);
  });
});

describe('fetchTmdbMetadata (movie)', () => {
  it('returns discriminated movie metadata with director from credits', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          title: 'Inception',
          release_date: '2010-07-16',
          poster_path: '/p.jpg',
          genres: [{ name: 'Action' }, { name: 'Sci-Fi' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          crew: [
            { job: 'Producer', name: 'Emma T' },
            { job: 'Director', name: 'Christopher Nolan' },
          ],
          cast: [{ name: 'Leo' }, { name: 'JGL' }, { name: 'Elliot' }, { name: 'Ken' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ keywords: [{ name: 'dream' }, { name: 'heist' }] }));

    const result = await fetchTmdbMetadata('movie', 27205);

    expect(result).toEqual({
      kind: 'movie',
      title: 'Inception',
      poster_path: '/p.jpg',
      release_year: '2010',
      director: 'Christopher Nolan',
      cast_list: ['Leo', 'JGL', 'Elliot'],
      genre_tags: ['Action', 'Sci-Fi', 'dream', 'heist'],
    });
  });

  it('returns null when detail fetch fails', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, false, 404))
      .mockResolvedValueOnce(jsonResponse({ crew: [], cast: [] }))
      .mockResolvedValueOnce(jsonResponse({ keywords: [] }));
    const result = await fetchTmdbMetadata('movie', 999);
    expect(result).toBeNull();
  });

  it('returns null when TMDB_API_KEY is unset', async () => {
    delete process.env.TMDB_API_KEY;
    const result = await fetchTmdbMetadata('movie', 1);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([0, -5, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid tmdb id %p without calling TMDB',
    async (badId) => {
      const result = await fetchTmdbMetadata('movie', badId);
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it('logs with a constant format string when fetch throws', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockRejectedValue(new Error('network down'));
    const result = await fetchTmdbMetadata('movie', 42);
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      'TMDB fetch failed for %s %d:',
      'movie',
      42,
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});

describe('fetchTmdbMetadata (show)', () => {
  it('returns discriminated show metadata with TV-specific fields', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          name: 'Severance',
          first_air_date: '2022-02-18',
          poster_path: '/s.jpg',
          genres: [{ name: 'Drama' }, { name: 'Mystery' }],
          created_by: [{ name: 'Dan Erickson' }],
          networks: [{ name: 'Apple TV+' }],
          number_of_seasons: 2,
          number_of_episodes: 19,
          status: 'Returning Series',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ crew: [], cast: [{ name: 'Adam Scott' }] }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ name: 'workplace' }] }));

    const result = await fetchTmdbMetadata('show', 95396);

    expect(result).toEqual({
      kind: 'show',
      title: 'Severance',
      poster_path: '/s.jpg',
      first_air_year: '2022',
      created_by: ['Dan Erickson'],
      networks: ['Apple TV+'],
      number_of_seasons: 2,
      number_of_episodes: 19,
      status: 'Returning Series',
      cast_list: ['Adam Scott'],
      genre_tags: ['Drama', 'Mystery', 'workplace'],
    });
  });

  it('uses /tv/{id}/... endpoints not /movie/', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ name: 'x', genres: [] }))
      .mockResolvedValueOnce(jsonResponse({ crew: [], cast: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));

    await fetchTmdbMetadata('show', 1);

    for (const call of mockFetch.mock.calls) {
      expect(call[0]).toContain('/tv/1');
      expect(call[0]).not.toContain('/movie/');
    }
  });
});

describe('fetchAndStoreTmdbData', () => {
  it('UPDATEs movies with movie columns', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          title: 'Dune',
          release_date: '2021-10-22',
          poster_path: '/d.jpg',
          genres: [{ name: 'Sci-Fi' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ crew: [{ job: 'Director', name: 'DV' }], cast: [] }))
      .mockResolvedValueOnce(jsonResponse({ keywords: [] }));
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await fetchAndStoreTmdbData('movie', 7, 438631);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('UPDATE movies');
    expect(sql).toContain('director');
    expect(params).toEqual(['/d.jpg', '2021', 'DV', [], ['Sci-Fi'], 7]);
  });

  it('UPDATEs shows with show-specific columns', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          name: 'The Bear',
          first_air_date: '2022-06-23',
          poster_path: '/b.jpg',
          genres: [{ name: 'Drama' }],
          created_by: [{ name: 'CS' }],
          networks: [{ name: 'FX' }],
          number_of_seasons: 4,
          number_of_episodes: 38,
          status: 'Returning Series',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ crew: [], cast: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await fetchAndStoreTmdbData('show', 12, 136315);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('UPDATE shows');
    expect(sql).toContain('first_air_year');
    expect(sql).toContain('number_of_seasons');
    expect(params).toEqual([
      '/b.jpg',
      '2022',
      ['CS'],
      ['FX'],
      [],
      ['Drama'],
      4,
      38,
      'Returning Series',
      12,
    ]);
  });

  it('is a no-op when metadata fetch returns null', async () => {
    delete process.env.TMDB_API_KEY;
    await fetchAndStoreTmdbData('movie', 1, 1);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
