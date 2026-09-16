const mockQuery = jest.fn();
jest.mock('../db', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

const mockRunKometaExport = jest.fn();
jest.mock('../kometaExport', () => ({
  runKometaExport: (...args: unknown[]) => mockRunKometaExport(...args),
}));

import {
  logAudit,
  triggerMdblistSyncInBackground,
  CONTENT_TABLE,
  AUDIT_TARGET_TYPE,
} from '../contentActions';

const ORIGINAL_ENV = process.env.NODE_ENV;
const ORIGINAL_MDBLIST = process.env.MDBLIST_API_KEY;

beforeEach(() => {
  mockQuery.mockReset();
  mockRunKometaExport.mockReset();
  process.env.NODE_ENV = 'test';
  delete process.env.MDBLIST_API_KEY;
});

afterAll(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
  if (ORIGINAL_MDBLIST === undefined) delete process.env.MDBLIST_API_KEY;
  else process.env.MDBLIST_API_KEY = ORIGINAL_MDBLIST;
});

describe('kind maps', () => {
  it('CONTENT_TABLE covers both kinds', () => {
    expect(CONTENT_TABLE.movie).toBe('movies');
    expect(CONTENT_TABLE.show).toBe('shows');
  });

  it('AUDIT_TARGET_TYPE covers both kinds', () => {
    expect(AUDIT_TARGET_TYPE.movie).toBe('movie');
    expect(AUDIT_TARGET_TYPE.show).toBe('show');
  });
});

describe('logAudit', () => {
  it('inserts into audit_logs with all parameters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await logAudit(7, 'MOVIE_ADD', 'movie', '42', { title: 'X' }, '10.0.0.1');
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'), [
      7,
      'MOVIE_ADD',
      'movie',
      '42',
      { title: 'X' },
      '10.0.0.1',
    ]);
  });

  it('swallows and logs errors without throwing (audit failure never breaks callers)', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    await expect(
      logAudit(1, 'MOVIE_ADD', 'movie', '1', null, '127.0.0.1'),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith('Failed to write audit log:', expect.any(Error));
    errSpy.mockRestore();
  });
});

describe('triggerMdblistSyncInBackground', () => {
  it('no-ops when MDBList API key is missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ mdblist_api_key: null }] });
    await triggerMdblistSyncInBackground(1, '127.0.0.1', 'movie_watched', { movieId: 5 });
    expect(mockRunKometaExport).not.toHaveBeenCalled();
  });

  it('runs export and audit-logs when key is present in DB', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ mdblist_api_key: 'db-key' }] })
      .mockResolvedValueOnce({ rows: [] }); // logAudit insert
    mockRunKometaExport.mockResolvedValueOnce({
      lists: [{ movieCount: 3 }, { movieCount: 5 }],
    });

    await triggerMdblistSyncInBackground(9, '127.0.0.1', 'movie_watched', { movieId: 42 });

    expect(mockRunKometaExport).toHaveBeenCalledWith(
      expect.objectContaining({ collectionsPath: null, mdblistApiKey: 'db-key' }),
    );
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.arrayContaining([
        9,
        'MDBLIST_AUTO_SYNC',
        'mdblist',
        null,
        expect.objectContaining({
          trigger: 'movie_watched',
          movieId: 42,
          listCount: 2,
          totalMovies: 8,
        }),
        '127.0.0.1',
      ]),
    );
  });

  it('falls back to env MDBLIST_API_KEY when DB row is null', async () => {
    process.env.MDBLIST_API_KEY = 'env-key';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ mdblist_api_key: null }] })
      .mockResolvedValueOnce({ rows: [] });
    mockRunKometaExport.mockResolvedValueOnce({ lists: [] });

    await triggerMdblistSyncInBackground(1, '127.0.0.1', 'trigger', {});

    expect(mockRunKometaExport).toHaveBeenCalledWith(
      expect.objectContaining({ mdblistApiKey: 'env-key' }),
    );
  });

  it('uses production namePrefix and environment when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ mdblist_api_key: 'k' }] })
      .mockResolvedValueOnce({ rows: [] });
    mockRunKometaExport.mockResolvedValueOnce({ lists: [] });

    await triggerMdblistSyncInBackground(1, '127.0.0.1', 't', {});

    expect(mockRunKometaExport).toHaveBeenCalledWith(
      expect.objectContaining({ namePrefix: '', environment: 'production' }),
    );
  });

  it('uses [DEV] namePrefix outside production', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ mdblist_api_key: 'k' }] })
      .mockResolvedValueOnce({ rows: [] });
    mockRunKometaExport.mockResolvedValueOnce({ lists: [] });

    await triggerMdblistSyncInBackground(1, '127.0.0.1', 't', {});

    expect(mockRunKometaExport).toHaveBeenCalledWith(
      expect.objectContaining({ namePrefix: '[DEV] ', environment: 'development' }),
    );
  });

  it('swallows export errors so the caller is never notified', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [{ mdblist_api_key: 'k' }] });
    mockRunKometaExport.mockRejectedValueOnce(new Error('mdblist 500'));

    await expect(triggerMdblistSyncInBackground(1, '127.0.0.1', 't', {})).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith('[MDBList auto-sync] Failed:', expect.any(Error));
    errSpy.mockRestore();
  });
});
