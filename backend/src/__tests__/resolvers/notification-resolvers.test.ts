import { mockQuery, authContext, anonContext } from './__helpers';
import { resolvers } from '../../resolvers';

const { subscribePush, unsubscribePush, updateNotificationPreference } = resolvers.Mutation;
const { notificationPreferences, appInfo } = resolvers.Query;

const validSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'pkey', auth: 'akey' },
};

beforeEach(() => {
  mockQuery.mockReset();
});

// ── Query.appInfo.vapidPublicKey ───────────────────────────────────────────────

describe('Query.appInfo.vapidPublicKey', () => {
  const orig = process.env.VAPID_PUBLIC_KEY;
  afterEach(() => {
    if (orig === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = orig;
  });

  it('returns the env var when set', () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key-xyz';
    const info = appInfo();
    expect(info.vapidPublicKey).toBe('public-key-xyz');
  });

  it('returns null when unset', () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const info = appInfo();
    expect(info.vapidPublicKey).toBeNull();
  });
});

// ── Query.notificationPreferences ─────────────────────────────────────────────

describe('Query.notificationPreferences', () => {
  it('unauthenticated throws', async () => {
    await expect((notificationPreferences as any)(null, {}, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('returns defaults (enabled=true) when no overrides exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await (notificationPreferences as any)(null, {}, authContext());
    expect(result).toEqual([{ eventType: 'MOVIE_ADD', enabled: true }]);
  });

  it('respects overrides from the DB', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ event_type: 'MOVIE_ADD', enabled: false }],
    });
    const result = await (notificationPreferences as any)(null, {}, authContext());
    expect(result).toEqual([{ eventType: 'MOVIE_ADD', enabled: false }]);
  });
});

// ── Mutation.subscribePush ────────────────────────────────────────────────────

describe('Mutation.subscribePush', () => {
  it('unauthenticated throws', async () => {
    await expect(
      (subscribePush as any)(null, { subscription: validSubscription }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });

  it('upserts a subscription on the happy path', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 11 }] }) // INSERT … ON CONFLICT
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await (subscribePush as any)(
      null,
      { subscription: validSubscription },
      authContext({ userId: 5 }),
    );
    expect(result).toBe(true);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO push_subscriptions');
    expect(sql).toContain('ON CONFLICT (endpoint) DO UPDATE');
    expect(params).toEqual([
      5,
      'https://fcm.googleapis.com/fcm/send/abc123',
      'pkey',
      'akey',
      'test-agent',
    ]);
  });

  it('rejects non-HTTPS endpoints', async () => {
    await expect(
      (subscribePush as any)(
        null,
        { subscription: { ...validSubscription, endpoint: 'http://insecure.example/x' } },
        authContext(),
      ),
    ).rejects.toThrow('Invalid push endpoint');
  });

  it('rejects oversized endpoints', async () => {
    const huge = 'https://x.example/' + 'a'.repeat(9000);
    await expect(
      (subscribePush as any)(
        null,
        { subscription: { ...validSubscription, endpoint: huge } },
        authContext(),
      ),
    ).rejects.toThrow('Invalid push endpoint');
  });

  it('rejects missing subscription keys', async () => {
    await expect(
      (subscribePush as any)(
        null,
        { subscription: { endpoint: validSubscription.endpoint, keys: { p256dh: '', auth: '' } } },
        authContext(),
      ),
    ).rejects.toThrow('Invalid push subscription keys');
  });
});

// ── Mutation.unsubscribePush ──────────────────────────────────────────────────

describe('Mutation.unsubscribePush', () => {
  it('unauthenticated throws', async () => {
    await expect(
      (unsubscribePush as any)(null, { endpoint: validSubscription.endpoint }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });

  it('scopes DELETE to the calling user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [] }); // logAudit
    await (unsubscribePush as any)(
      null,
      { endpoint: validSubscription.endpoint },
      authContext({ userId: 5 }),
    );
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('DELETE FROM push_subscriptions');
    expect(sql).toContain('user_id = $2');
    expect(params).toEqual([validSubscription.endpoint, 5]);
  });

  it('returns true even when no row was deleted (no enumeration leak)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // DELETE returning no rows
    const result = await (unsubscribePush as any)(
      null,
      { endpoint: validSubscription.endpoint },
      authContext({ userId: 5 }),
    );
    expect(result).toBe(true);
    // Should not call logAudit (mockQuery only called once for DELETE)
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('returns true for malformed input without querying DB', async () => {
    const result = await (unsubscribePush as any)(null, { endpoint: '' }, authContext());
    expect(result).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// ── Mutation.updateNotificationPreference ─────────────────────────────────────

describe('Mutation.updateNotificationPreference', () => {
  it('unauthenticated throws', async () => {
    await expect(
      (updateNotificationPreference as any)(
        null,
        { eventType: 'MOVIE_ADD', enabled: false },
        anonContext(),
      ),
    ).rejects.toThrow('Not authenticated');
  });

  it('upserts a preference on the happy path', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPSERT
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    const result = await (updateNotificationPreference as any)(
      null,
      { eventType: 'MOVIE_ADD', enabled: false },
      authContext({ userId: 3 }),
    );
    expect(result).toEqual({ eventType: 'MOVIE_ADD', enabled: false });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO user_notification_preferences');
    expect(sql).toContain('ON CONFLICT (user_id, event_type)');
    expect(params).toEqual([3, 'MOVIE_ADD', false]);
  });

  it('rejects unknown event types', async () => {
    await expect(
      (updateNotificationPreference as any)(
        null,
        { eventType: 'NOT_A_REAL_EVENT', enabled: true },
        authContext(),
      ),
    ).rejects.toThrow('Unknown notification event type');
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
