const mockQuery = jest.fn();
jest.mock('../db', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockReaddir = jest.fn().mockResolvedValue([]);
const mockStat = jest.fn();
const mockUnlink = jest.fn().mockResolvedValue(undefined);
jest.mock('fs', () => ({
  promises: {
    mkdir: (...args: any[]) => mockMkdir(...args),
    writeFile: (...args: any[]) => mockWriteFile(...args),
    readdir: (...args: any[]) => mockReaddir(...args),
    stat: (...args: any[]) => mockStat(...args),
    unlink: (...args: any[]) => mockUnlink(...args),
  },
}));

import { runBackup, initBackupScheduler } from '../backup';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('runBackup', () => {
  const movieRows = [{ id: 1, title: 'Test Movie', rank: 1 }];
  const userRows = [{ id: 1, username: 'admin' }];
  const scheduleRows = [{ id: 1, enabled: true }];

  function setupDbMock() {
    mockQuery
      .mockResolvedValueOnce({ rows: movieRows })
      .mockResolvedValueOnce({ rows: userRows })
      .mockResolvedValueOnce({ rows: scheduleRows });
  }

  it('throws if DB_BACKUP_PATH is not set', async () => {
    delete process.env.DB_BACKUP_PATH;
    await expect(runBackup()).rejects.toThrow('DB_BACKUP_PATH not configured');
  });

  it('writes a JSON backup file with correct structure', async () => {
    process.env.DB_BACKUP_PATH = '/backups';
    setupDbMock();

    const filename = await runBackup();

    expect(filename).toMatch(/^movienight_\d{4}-\d{2}-\d{2}_\d{6}\.json$/);
    expect(mockMkdir).toHaveBeenCalledWith('/backups', { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);

    const [filePath, content] = mockWriteFile.mock.calls[0];
    expect(filePath).toContain('/backups/movienight_');
    const parsed = JSON.parse(content);
    expect(parsed.version).toBe(1);
    expect(parsed.exported_at).toBeDefined();
    expect(parsed.movies).toEqual(movieRows);
    expect(parsed.users).toEqual(userRows);
    expect(parsed.kometa_schedule).toEqual(scheduleRows);
  });

  it('queries all three tables', async () => {
    process.env.DB_BACKUP_PATH = '/backups';
    setupDbMock();

    await runBackup();

    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM movies ORDER BY rank');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users ORDER BY id');
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM kometa_schedule ORDER BY id');
  });

  it('prunes old backup files beyond keep days', async () => {
    process.env.DB_BACKUP_PATH = '/backups';
    process.env.DB_BACKUP_KEEP_DAYS = '7';
    setupDbMock();

    const oldFile = 'movienight_2020-01-01_030000.json';
    const recentFile = 'movienight_2099-01-01_030000.json';
    const nonBackupFile = 'other.json';
    mockReaddir.mockResolvedValueOnce([oldFile, recentFile, nonBackupFile]);
    mockStat
      .mockResolvedValueOnce({ mtimeMs: 0 }) // old — should be pruned
      .mockResolvedValueOnce({ mtimeMs: Date.now() }); // recent — should be kept

    await runBackup();

    // Only the old file should be unlinked
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(mockUnlink).toHaveBeenCalledWith('/backups/' + oldFile);
  });

  it('skips non-backup files during pruning', async () => {
    process.env.DB_BACKUP_PATH = '/backups';
    setupDbMock();
    mockReaddir.mockResolvedValueOnce(['notes.txt', 'readme.md']);

    await runBackup();

    expect(mockStat).not.toHaveBeenCalled();
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});

describe('initBackupScheduler', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs disabled message when DB_BACKUP_PATH is not set', () => {
    delete process.env.DB_BACKUP_PATH;
    const spy = jest.spyOn(console, 'log').mockImplementation();

    initBackupScheduler();

    expect(spy).toHaveBeenCalledWith('[Backup] DB_BACKUP_PATH not set, scheduler disabled');
  });

  it('logs enabled message and schedules when DB_BACKUP_PATH is set', () => {
    process.env.DB_BACKUP_PATH = '/backups';
    process.env.DB_BACKUP_SCHEDULE = 'hourly';
    const spy = jest.spyOn(console, 'log').mockImplementation();
    jest.useFakeTimers();

    initBackupScheduler();

    expect(spy).toHaveBeenCalledWith('[Backup] Scheduler enabled (hourly)');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[Backup] Next scheduled backup'));

    jest.useRealTimers();
  });

  it('defaults to daily schedule', () => {
    process.env.DB_BACKUP_PATH = '/backups';
    delete process.env.DB_BACKUP_SCHEDULE;
    const spy = jest.spyOn(console, 'log').mockImplementation();
    jest.useFakeTimers();

    initBackupScheduler();

    expect(spy).toHaveBeenCalledWith('[Backup] Scheduler enabled (daily)');

    jest.useRealTimers();
  });
});
