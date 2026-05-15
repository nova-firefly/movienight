// Mock pool before importing push
const mockQuery = jest.fn();
jest.mock('../db', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

// Mock web-push
const mockSendNotification = jest.fn();
const mockSetVapidDetails = jest.fn();

class FakeWebPushError extends Error {
  statusCode: number;
  constructor(statusCode: number) {
    super(`status ${statusCode}`);
    this.statusCode = statusCode;
  }
}

jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: (...args: any[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: any[]) => mockSendNotification(...args),
  },
  WebPushError: FakeWebPushError,
}));

import { configurePush, isPushConfigured, sendPushToUser, sendPushToUsersExcept } from '../push';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockQuery.mockReset();
  mockSendNotification.mockReset();
  mockSetVapidDetails.mockReset();
  // Reset env to a clean slate per test
  process.env = { ...ORIGINAL_ENV };
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const fakeSub = (overrides: Partial<{ id: number; user_id: number }> = {}) => ({
  id: overrides.id ?? 1,
  user_id: overrides.user_id ?? 10,
  endpoint: 'https://push.example/abc',
  p256dh: 'p256-key',
  auth: 'auth-key',
});

describe('configurePush', () => {
  it('returns false when VAPID keys are unset', () => {
    expect(configurePush()).toBe(false);
    expect(isPushConfigured()).toBe(false);
    expect(mockSetVapidDetails).not.toHaveBeenCalled();
  });

  it('returns true and calls setVapidDetails when keys are present', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    expect(configurePush()).toBe(true);
    expect(isPushConfigured()).toBe(true);
    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      'mailto:noreply@movienight.local',
      'pub',
      'priv',
    );
  });

  it('uses VAPID_SUBJECT when provided', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:me@example.com';
    configurePush();
    expect(mockSetVapidDetails).toHaveBeenCalledWith('mailto:me@example.com', 'pub', 'priv');
  });

  it('returns false and logs if setVapidDetails throws', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    mockSetVapidDetails.mockImplementationOnce(() => {
      throw new Error('bad key');
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(configurePush()).toBe(false);
    expect(isPushConfigured()).toBe(false);
    errSpy.mockRestore();
  });
});

describe('sendPushToUser', () => {
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    configurePush();
  });

  it('returns 0/0 when not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    configurePush();
    const result = await sendPushToUser(1, { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 0, pruned: 0 });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('delivers to all of user’s subscriptions on success', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [fakeSub({ id: 1 }), fakeSub({ id: 2 })],
    });
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
    // Per-row UPDATE calls
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await sendPushToUser(10, { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 2, pruned: 0 });
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });
});

describe('sendPushToUsersExcept', () => {
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    configurePush();
  });

  it('returns 0/0 when not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    configurePush();
    const result = await sendPushToUsersExcept(1, 'MOVIE_ADD', { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 0, pruned: 0 });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('queries excluding requester and disabled preferences', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await sendPushToUsersExcept(42, 'MOVIE_ADD', { title: 't', body: 'b' });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('user_id != $1');
    expect(sql).toContain('user_notification_preferences');
    expect(sql).toContain('enabled = false');
    expect(params).toEqual([42, 'MOVIE_ADD']);
  });

  it('sends JSON-encoded payload', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [fakeSub()] });
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
    mockQuery.mockResolvedValue({ rows: [] });

    await sendPushToUsersExcept(99, 'MOVIE_ADD', {
      title: 'New movie added',
      body: 'Alice added "Dune"',
      url: '/',
    });

    expect(mockSendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example/abc',
        keys: { p256dh: 'p256-key', auth: 'auth-key' },
      },
      JSON.stringify({
        title: 'New movie added',
        body: 'Alice added "Dune"',
        url: '/',
      }),
    );
  });

  it('prunes subscription on 410 Gone', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [fakeSub({ id: 7 })] });
    mockSendNotification.mockRejectedValueOnce(new FakeWebPushError(410));
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await sendPushToUsersExcept(1, 'MOVIE_ADD', { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 0, pruned: 1 });
    const deleteCall = mockQuery.mock.calls.find(([sql]) =>
      sql.includes('DELETE FROM push_subscriptions'),
    );
    expect(deleteCall?.[1]).toEqual([7]);
    warnSpy.mockRestore();
  });

  it('prunes subscription on 404', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [fakeSub({ id: 9 })] });
    mockSendNotification.mockRejectedValueOnce(new FakeWebPushError(404));
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await sendPushToUsersExcept(1, 'MOVIE_ADD', { title: 't', body: 'b' });
    expect(result.pruned).toBe(1);
    warnSpy.mockRestore();
  });

  it('increments failure_count on 500 without pruning when below threshold', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [fakeSub({ id: 3 })] });
    mockSendNotification.mockRejectedValueOnce(new FakeWebPushError(500));
    // UPDATE failure_count returning current count = 2
    mockQuery.mockResolvedValueOnce({ rows: [{ failure_count: 2 }] });

    const result = await sendPushToUsersExcept(1, 'MOVIE_ADD', { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 1, pruned: 0 });
    const updateCall = mockQuery.mock.calls.find(([sql]) =>
      sql.includes('failure_count = failure_count + 1'),
    );
    expect(updateCall?.[1]).toEqual([3]);
    // Confirm no DELETE was issued
    const deleteCall = mockQuery.mock.calls.find(([sql]) =>
      sql.includes('DELETE FROM push_subscriptions'),
    );
    expect(deleteCall).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('prunes when failure_count reaches threshold (5)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [fakeSub({ id: 4 })] });
    mockSendNotification.mockRejectedValueOnce(new FakeWebPushError(500));
    // UPDATE returns count = 5 → triggers DELETE
    mockQuery.mockResolvedValueOnce({ rows: [{ failure_count: 5 }] });
    mockQuery.mockResolvedValue({ rows: [] }); // DELETE

    const result = await sendPushToUsersExcept(1, 'MOVIE_ADD', { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 0, pruned: 1 });
    const deleteCall = mockQuery.mock.calls.find(([sql]) =>
      sql.includes('DELETE FROM push_subscriptions'),
    );
    expect(deleteCall?.[1]).toEqual([4]);
    warnSpy.mockRestore();
  });

  it('marks delivered on success and resets failure_count', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [fakeSub({ id: 5 })] });
    mockSendNotification.mockResolvedValueOnce({ statusCode: 201 });
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await sendPushToUsersExcept(1, 'MOVIE_ADD', { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 1, pruned: 0 });
    const updateCall = mockQuery.mock.calls.find(([sql]) => sql.includes('last_used_at = NOW()'));
    expect(updateCall?.[1]).toEqual([5]);
  });

  it('handles mixed success and pruned results', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({
      rows: [fakeSub({ id: 1 }), fakeSub({ id: 2 })],
    });
    mockSendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(new FakeWebPushError(410));
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await sendPushToUsersExcept(1, 'MOVIE_ADD', { title: 't', body: 'b' });
    expect(result).toEqual({ delivered: 1, pruned: 1 });
    warnSpy.mockRestore();
  });
});
