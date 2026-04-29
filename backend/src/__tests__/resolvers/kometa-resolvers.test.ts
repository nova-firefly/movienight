import {
  mockQuery,
  mockWriteFile,
  mockFetch,
  mockRescheduleKometa,
  adminContext,
  authContext,
} from './__helpers';

// Mock the shared kometaExport module
const mockRunKometaExport = jest.fn();
jest.mock('../../kometaExport', () => ({
  runKometaExport: (...args: any[]) => mockRunKometaExport(...args),
}));

import { resolvers } from '../../resolvers';

const { exportKometa, updateKometaSchedule, setMdblistApiKey } = resolvers.Mutation;

beforeEach(() => {
  mockRunKometaExport.mockReset();
});

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
    // kometa_schedule SELECT (no DB API key either)
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_api_key: null }],
    });
    await expect(exportKometa(null, {}, adminContext())).rejects.toThrow(
      'MDBList API key is not configured',
    );
  });

  it('throws when no exportable lists are found', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    delete process.env.KOMETA_TRIGGER_URL;
    // kometa_schedule SELECT
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_api_key: null }],
    });
    // runKometaExport returns empty lists
    mockRunKometaExport.mockResolvedValueOnce({
      filePath: '/tmp/kometa/movienight.yml',
      lists: [],
    });
    await expect(exportKometa(null, {}, adminContext())).rejects.toThrow(
      'No exportable lists found',
    );
  });

  it('calls runKometaExport and returns lists', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    delete process.env.KOMETA_TRIGGER_URL;

    // kometa_schedule SELECT
    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_api_key: null }],
    });
    // runKometaExport
    mockRunKometaExport.mockResolvedValueOnce({
      filePath: '/tmp/kometa/movienight.yml',
      lists: [
        {
          name: 'Alice & Bob',
          type: 'combined',
          movieCount: 3,
          mdblistUrl: 'https://mdblist.com/lists/u/ab',
        },
        {
          name: 'Just Alice',
          type: 'solo',
          movieCount: 1,
          mdblistUrl: 'https://mdblist.com/lists/u/ja',
        },
      ],
    });
    // audit log
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await exportKometa(null, {}, adminContext());
    expect(result.filePath).toBe('/tmp/kometa/movienight.yml');
    expect(result.lists).toHaveLength(2);
    expect(result.lists[0].name).toBe('Alice & Bob');
    expect(result.lists[1].name).toBe('Just Alice');
    expect(result.triggered).toBe(false);
    expect(mockRunKometaExport).toHaveBeenCalledWith('/tmp/kometa', 'test-key');
  });

  it('triggers webhook when KOMETA_TRIGGER_URL is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.MDBLIST_API_KEY = 'test-key';
    process.env.KOMETA_TRIGGER_URL = 'http://kometa:5000/run';

    mockQuery.mockResolvedValueOnce({
      rows: [{ mdblist_api_key: null }],
    });
    mockRunKometaExport.mockResolvedValueOnce({
      filePath: '/tmp/kometa/movienight.yml',
      lists: [
        { name: 'A & B', type: 'combined', movieCount: 1, mdblistUrl: 'https://example.com' },
      ],
    });
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
      rows: [{ mdblist_api_key: null }],
    });
    mockRunKometaExport.mockResolvedValueOnce({
      filePath: '/tmp/kometa/movienight.yml',
      lists: [
        { name: 'A & B', type: 'combined', movieCount: 1, mdblistUrl: 'https://example.com' },
      ],
    });
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
            last_run_at: null,
            mdblist_api_key: null,
          },
        ],
      }) // SELECT updated
      .mockResolvedValueOnce({ rows: [] }); // kometa_mdblist_lists SELECT
    const result = await updateKometaSchedule(
      null,
      { enabled: true, frequency: 'hourly' },
      adminContext(),
    );
    expect(result.enabled).toBe(true);
    expect(result.frequency).toBe('hourly');
    expect(result.exportedLists).toEqual([]);
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
            last_run_at: null,
            mdblist_api_key: 'new-key',
          },
        ],
      }) // SELECT kometa_schedule
      .mockResolvedValueOnce({ rows: [] }); // kometa_mdblist_lists SELECT

    const result = await setMdblistApiKey(null, { apiKey: 'new-key' }, adminContext());
    expect(result.mdblistApiKeySet).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.exportedLists).toEqual([]);
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE kometa_schedule SET mdblist_api_key = $1, updated_at = NOW() WHERE id = 1',
      ['new-key'],
    );
  });

  it('trims whitespace from API key', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            enabled: false,
            frequency: 'daily',
            daily_time: '03:00',
            last_run_at: null,
            mdblist_api_key: 'trimmed',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // kometa_mdblist_lists SELECT

    await setMdblistApiKey(null, { apiKey: '  trimmed  ' }, adminContext());
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE kometa_schedule SET mdblist_api_key = $1, updated_at = NOW() WHERE id = 1',
      ['trimmed'],
    );
  });
});
