jest.mock('../db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../kometaExport', () => ({
  runKometaExport: jest.fn(),
}));

import pool from '../db';
import { initScheduler, rescheduleKometa } from '../scheduler';

const mockQuery = pool.query as jest.Mock;

describe('initScheduler', () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    jest.clearAllTimers();
  });

  it('non-production: logs disabled, does not query DB', async () => {
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await initScheduler();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Disabled (non-production environment)'),
    );
    expect(mockQuery).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('production + no schedule row: returns without scheduling', async () => {
    process.env.NODE_ENV = 'production';
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await initScheduler();
    // No error thrown
  });

  it('production + disabled schedule: logs disabled', async () => {
    process.env.NODE_ENV = 'production';
    mockQuery.mockResolvedValueOnce({
      rows: [{ enabled: false, frequency: 'daily', daily_time: '03:00' }],
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await initScheduler();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Disabled, not starting'));
    consoleSpy.mockRestore();
  });

  it('production + enabled: starts scheduling', async () => {
    jest.useFakeTimers();
    process.env.NODE_ENV = 'production';
    mockQuery.mockResolvedValueOnce({
      rows: [{ enabled: true, frequency: 'hourly', daily_time: '03:00' }],
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await initScheduler();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Starting'));
    consoleSpy.mockRestore();
    jest.useRealTimers();
  });
});

describe('rescheduleKometa', () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    jest.clearAllTimers();
  });

  it('non-production: logs skip', () => {
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    rescheduleKometa(true, 'hourly', '03:00');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Reschedule skipped'));
    consoleSpy.mockRestore();
  });

  it('production + disabled: logs disabled', () => {
    jest.useFakeTimers();
    process.env.NODE_ENV = 'production';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    rescheduleKometa(false, 'daily', '03:00');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Disabled'));
    consoleSpy.mockRestore();
    jest.useRealTimers();
  });

  it('production + enabled: schedules new export', () => {
    jest.useFakeTimers();
    process.env.NODE_ENV = 'production';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    rescheduleKometa(true, 'hourly', '03:00');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Rescheduling'));
    consoleSpy.mockRestore();
    jest.useRealTimers();
  });
});
