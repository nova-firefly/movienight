import {
  mockQuery,
  mockWriteFile,
  mockFetch,
  mockRescheduleKometa,
  adminContext,
  authContext,
} from './__helpers';
import { resolvers } from '../../resolvers';

const { exportKometa, updateKometaSchedule } = resolvers.Mutation;

describe('Mutation.exportKometa', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = origEnv.NODE_ENV;
    process.env.KOMETA_COLLECTIONS_PATH = origEnv.KOMETA_COLLECTIONS_PATH;
    process.env.KOMETA_TRIGGER_URL = origEnv.KOMETA_TRIGGER_URL;
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

  it('no TMDB-matched movies throws BAD_USER_INPUT', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'A', tmdb_id: null, elo_rank: null }],
    });
    await expect(exportKometa(null, {}, adminContext())).rejects.toThrow(
      'No movies with TMDB IDs to export',
    );
  });

  it('writes YAML file and returns filePath', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    delete process.env.KOMETA_TRIGGER_URL;
    mockQuery.mockResolvedValueOnce({
      rows: [
        { title: 'Inception', tmdb_id: 27205, elo_rank: 1050 },
        { title: 'Dune', tmdb_id: 438631, elo_rank: 1020 },
      ],
    });
    mockWriteFile.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] }); // logAudit

    const result = await exportKometa(null, {}, adminContext());
    expect(result.filePath).toContain('movienight.yml');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('movienight.yml'),
      expect.stringContaining('27205'),
      'utf8',
    );
  });

  it('triggers webhook when KOMETA_TRIGGER_URL is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KOMETA_COLLECTIONS_PATH = '/tmp/kometa';
    process.env.KOMETA_TRIGGER_URL = 'http://kometa:5000/run';
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'A', tmdb_id: 100, elo_rank: 1000 }],
    });
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
    process.env.KOMETA_TRIGGER_URL = 'http://kometa:5000/run';
    mockQuery.mockResolvedValueOnce({
      rows: [{ title: 'A', tmdb_id: 100, elo_rank: 1000 }],
    });
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
    expect(mockRescheduleKometa).toHaveBeenCalledWith(true, 'hourly', '03:00');
  });
});
