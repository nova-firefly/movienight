import {
  mockQuery,
  mockWriteFile,
  mockFetch,
  mockRescheduleKometa,
  mockCreateList,
  mockSyncList,
  adminContext,
  authContext,
} from './__helpers';
import { resolvers } from '../../resolvers';

const { exportKometa, updateKometaSchedule, setMdblistApiKey } = resolvers.Mutation;

describe('Mutation.exportKometa', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = origEnv.NODE_ENV;
    process.env.KOMETA_COLLECTIONS_PATH = origEnv.KOMETA_COLLECTIONS_PATH;
    process.env.KOMETA_TRIGGER_URL = origEnv.KOMETA_TRIGGER_URL;
    process.env.MDBLIST_API_KEY = origEnv.MDBLIST_API_KEY;
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(exportKometa(null, {}, authContext())).rejects.toThrow('Not authorized');
  });

  it('non-production throws FORBIDDEN', async () => {
    process.env.NODE_ENV = 'development';
    await expect(exportKometa(null, {}, adminContext())).rejects.toThrow(
      'Kometa export is disabled outside of production',
    );
  });

  it('missing KOMETA_COLLECTIONS_PATH throws INTERNAL_SERVER_ERROR', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.KOMETA_COLLECTIONS_PATH;
    await expect(exportKometa(null, {}, adminContext())).rejects.toThrow(
      'KOMETA_COLLECTIONS_PATH is not configured',
    );
  });

  it('missing MDBList API key throws BAD_USER_INPUT', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    delete process.env.MDBLIST_API_KEY;
    // Movies query
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'Movie', tmdb_id: 100, elo_rank: 1000 }],
    });
    // kometa_schedule SELECT (no DB API key either)
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: null, mdblist_list_url: null, mdblist_api_key: null }],
    });
    await expect(exportKometa(null, {}, adminContext())).rejects.toThrow(
      'MDBList API key is not configured',
    );
  });

  it('no TMDB-matched movies throws BAD_USER_INPUT', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'A', tmdb_id: null, elo_rank: null }],
    });
    await expect(exportKometa(null, {}, adminContext())).rejects.toThrow(
      'No movies with TMDB IDs to export',
    );
  });

  it('filters out tmdb_id=0', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    mockQuery.mockResolvedValueOnce({
      rows: [
        { title: 'Bad', tmdb_id: 0, elo_rank: 1000 },
        { title: 'Null', tmdb_id: null, elo_rank: 900 },
      ],
    });
    await expect(exportKometa(null, {}, adminContext())).rejects.toThrow(
      'No movies with TMDB IDs to export',
    );
  });

  it('creates MDBList list on first export and writes YAML with mdblist_list', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    delete process.env.KOMETA_TRIGGER_URL;

    // Movies query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { title: 'Inception', tmdb_id: 27205, elo_rank: 1050 },
        { title: 'Dune', tmdb_id: 438631, elo_rank: 1020 },
      ],
    });
    // kometa_schedule SELECT (no existing list)
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: null, mdblist_list_url: null }],
    });
    // createList result
    mockCreateList.mockResolvedValueOnce({
      id: 42,
      slug: 'movienight-watchlist',
      url: 'https://mdblist.com/lists/testuser/movienight-watchlist',
    });
    // UPDATE mdblist_list_id/url
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // syncList
    mockSyncList.mockResolvedValueOnce(undefined);
    // writeFile
    mockWriteFile.mockResolvedValue(undefined);
    // logAudit
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await exportKometa(null, {}, adminContext());
    expect(result.filePath).toContain('movienight.yml');
    expect(mockCreateList).toHaveBeenCalledWith('test-key', 'MovieNight Watchlist');
    expect(mockSyncList).toHaveBeenCalledWith('test-key', 42, [27205, 438631]);
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('movienight.yml'),
      expect.stringContaining(
        'mdblist_list: https://mdblist.com/lists/testuser/movienight-watchlist',
      ),
      'utf8',
    );
    // YAML should contain collection_order: custom
    const writtenYaml = mockWriteFile.mock.calls[0][1];
    expect(writtenYaml).toContain('collection_order: custom');
    expect(writtenYaml).not.toContain('tmdb_movie');
  });

  it('reuses existing MDBList list on subsequent exports', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    delete process.env.KOMETA_TRIGGER_URL;

    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'Movie', tmdb_id: 100, elo_rank: 1000 }],
    });
    // kometa_schedule SELECT (existing list)
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 42, mdblist_list_url: 'https://mdblist.com/lists/user/list' }],
    });
    mockSyncList.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] });

    await exportKometa(null, {}, adminContext());
    expect(mockCreateList).not.toHaveBeenCalled();
    expect(mockSyncList).toHaveBeenCalledWith('test-key', 42, [100]);
  });

  it('sanitizes collection name to prevent YAML injection', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    delete process.env.KOMETA_TRIGGER_URL;
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'Movie', tmdb_id: 1, elo_rank: 1000 }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 1, mdblist_list_url: 'https://mdblist.com/lists/u/l' }],
    });
    mockSyncList.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] });

    await exportKometa(null, { collectionName: 'Evil: {inject}\nmalicious: true' }, adminContext());
    const writtenYaml = mockWriteFile.mock.calls[0][1];
    expect(writtenYaml).not.toContain('{inject}');
    expect(writtenYaml).not.toContain('malicious: true');
    expect(writtenYaml).toContain('Evil inject');
  });

  it('uses default name when sanitized collectionName is empty', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    delete process.env.KOMETA_TRIGGER_URL;
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'Movie', tmdb_id: 1, elo_rank: 1000 }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 1, mdblist_list_url: 'https://mdblist.com/lists/u/l' }],
    });
    mockSyncList.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] });

    await exportKometa(null, { collectionName: ':::' }, adminContext());
    const writtenYaml = mockWriteFile.mock.calls[0][1];
    expect(writtenYaml).toContain('MovieNight Watchlist');
  });

  it('truncates collection name exceeding 100 characters', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    delete process.env.KOMETA_TRIGGER_URL;
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'Movie', tmdb_id: 1, elo_rank: 1000 }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 1, mdblist_list_url: 'https://mdblist.com/lists/u/l' }],
    });
    mockSyncList.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] });

    const longName = 'A'.repeat(150);
    await exportKometa(null, { collectionName: longName }, adminContext());
    const writtenYaml = mockWriteFile.mock.calls[0][1];
    expect(writtenYaml).toContain('A'.repeat(100));
    expect(writtenYaml).not.toContain('A'.repeat(101));
  });

  it('triggers webhook when KOMETA_TRIGGER_URL is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    process.env.KOMETA_TRIGGER_URL = 'http://kometa:5000/run';
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'A', tmdb_id: 100, elo_rank: 1000 }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 1, mdblist_list_url: 'https://mdblist.com/lists/u/l' }],
    });
    mockSyncList.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await exportKometa(null, {}, adminContext());
    expect(result.triggered).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://kometa:5000/run',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('webhook failure returns triggerError', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    process.env.KOMETA_TRIGGER_URL = 'http://kometa:5000/run';
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'A', tmdb_id: 100, elo_rank: 1000 }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_list_id: 1, mdblist_list_url: 'https://mdblist.com/lists/u/l' }],
    });
    mockSyncList.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await exportKometa(null, {}, adminContext());
    expect(result.triggered).toBe(false);
    expect(result.triggerError).toBe('Connection refused');
  });
});

describe('Mutation.updateKometaSchedule', () => {
  const origEnv = { ...process.env };
  afterEach(() => {
    process.env.NODE_ENV = origEnv.NODE_ENV;
  });

  it('non-admin throws FORBIDDEN', async () => {
    await expect(updateKometaSchedule(null, { enabled: true }, authContext())).rejects.toThrow(
      'Not authorized',
    );
  });

  it('enabling in non-production throws FORBIDDEN', async () => {
    process.env.NODE_ENV = 'development';
    await expect(updateKometaSchedule(null, { enabled: true }, adminContext())).rejects.toThrow(
      'Scheduled Kometa export cannot be enabled outside of production',
    );
  });

  it('invalid frequency throws BAD_USER_INPUT', async () => {
    await expect(
      updateKometaSchedule(null, { frequency: 'weekly' }, adminContext()),
    ).rejects.toThrow('frequency must be "hourly" or "daily"');
  });

  it('invalid dailyTime format throws BAD_USER_INPUT', async () => {
    await expect(updateKometaSchedule(null, { dailyTime: 'noon' }, adminContext())).rejects.toThrow(
      'dailyTime must be in HH:MM format',
    );
  });

  it('admin can update schedule and calls rescheduleKometa', async () => {
    process.env.NODE_ENV = 'production';
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({
        rows: [
          {
            enabled: true,
            frequency: 'hourly',
            daily_time: '03:00',
            collection_name: null,
            last_run_at: null,
            mdblist_list_url: null,
          },
        ],
      }); // SELECT updated
    const result = await updateKometaSchedule(
      null,
      { enabled: true, frequency: 'hourly' },
      adminContext(),
    );
    expect(result.enabled).toBe(true);
    expect(result.frequency).toBe('hourly');
    expect(result.mdblistListUrl).toBeNull();
    expect(mockRescheduleKometa).toHaveBeenCalledWith(true, 'hourly', '03:00');
  });
});

describe('Mutation.setMdblistApiKey', () => {
  it('non-admin throws FORBIDDEN', async () => {
    await expect(setMdblistApiKey(null, { apiKey: 'key' }, authContext())).rejects.toThrow(
      'Not authorized',
    );
  });

  it('empty key throws BAD_USER_INPUT', async () => {
    await expect(setMdblistApiKey(null, { apiKey: '   ' }, adminContext())).rejects.toThrow(
      'API key cannot be empty',
    );
  });

  it('admin can set API key and gets back updated schedule', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({
        rows: [
          {
            enabled: false,
            frequency: 'daily',
            daily_time: '03:00',
            collection_name: null,
            last_run_at: null,
            mdblist_list_url: null,
            mdblist_api_key: 'new-key',
          },
        ],
      });

    const result = await setMdblistApiKey(null, { apiKey: 'new-key' }, adminContext());
    expect(result.mdblistApiKeySet).toBe(true);
    expect(result.enabled).toBe(false);
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE kometa_schedule SET mdblist_api_key = $1, updated_at = NOW() WHERE id = 1',
      ['new-key'],
    );
  });

  it('trims whitespace from API key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          enabled: false,
          frequency: 'daily',
          daily_time: '03:00',
          collection_name: null,
          last_run_at: null,
          mdblist_list_url: null,
          mdblist_api_key: 'trimmed',
        },
      ],
    });

    await setMdblistApiKey(null, { apiKey: '  trimmed  ' }, adminContext());
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE kometa_schedule SET mdblist_api_key = $1, updated_at = NOW() WHERE id = 1',
      ['trimmed'],
    );
  });
});
