import {
  mockQuery,
  mockHashPassword,
  mockGenerateToken,
  mockCreatePlexPin,
  mockWaitForPlexAuth,
  mockGetPlexUser,
  mockGetPlexAuthUrl,
  mockGetSetting,
  mockSetSetting,
  authContext,
  adminContext,
  anonContext,
} from './__helpers';
import { resolvers } from '../../resolvers';

const { createPlexPin, completePlexAuth, linkPlexAccount, unlinkPlexAccount, updateAppSetting } =
  resolvers.Mutation;

const plexUser = {
  id: 42,
  uuid: 'uuid-42',
  username: 'plexbob',
  email: 'bob@example.com',
  thumb: 'https://plex.tv/thumb.jpg',
};

const dbUser = {
  id: 1,
  username: 'bob',
  email: 'bob@example.com',
  display_name: 'Bob',
  is_admin: false,
  is_active: true,
  last_login_at: null,
  plex_id: '42',
  plex_username: 'plexbob',
  plex_thumb: 'https://plex.tv/thumb.jpg',
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no DB settings, fall back to env vars
  mockGetSetting.mockResolvedValue(null);
  mockSetSetting.mockResolvedValue(undefined);
});

describe('Mutation.createPlexPin', () => {
  it('returns pinId, code, and authUrl', async () => {
    mockCreatePlexPin.mockResolvedValue({ id: 999, code: 'pin-code', authToken: null });
    mockGetPlexAuthUrl.mockReturnValue('https://app.plex.tv/auth#?code=pin-code');

    const result = await (createPlexPin as any)(null, {}, anonContext());
    expect(result).toEqual({
      pinId: 999,
      code: 'pin-code',
      authUrl: 'https://app.plex.tv/auth#?code=pin-code',
    });
  });
});

describe('Mutation.completePlexAuth', () => {
  const ctx = anonContext();

  it('returns token and user when Plex account is already linked', async () => {
    mockWaitForPlexAuth.mockResolvedValue('plex-token');
    mockGetPlexUser.mockResolvedValue(plexUser);
    mockQuery
      .mockResolvedValueOnce({ rows: [dbUser] }) // SELECT by plex_id
      .mockResolvedValueOnce({ rows: [] }) // UPDATE last_login_at
      .mockResolvedValueOnce({ rows: [] }) // logLoginHistory
      .mockResolvedValueOnce({ rows: [] }); // logAudit
    mockGenerateToken.mockReturnValue('jwt-123');

    const result = await completePlexAuth(null, { pinId: 1 }, ctx);
    expect(result.token).toBe('jwt-123');
    expect(result.user.username).toBe('bob');
  });

  it('auto-links by email match for existing user', async () => {
    mockWaitForPlexAuth.mockResolvedValue('plex-token');
    mockGetPlexUser.mockResolvedValue(plexUser);
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT by plex_id — not found
      .mockResolvedValueOnce({ rows: [{ ...dbUser, plex_id: null }] }) // SELECT by email — found
      .mockResolvedValueOnce({ rows: [] }) // UPDATE plex fields
      .mockResolvedValueOnce({ rows: [] }) // logAudit PLEX_LINK
      .mockResolvedValueOnce({ rows: [] }) // UPDATE last_login_at
      .mockResolvedValueOnce({ rows: [] }) // logLoginHistory
      .mockResolvedValueOnce({ rows: [] }); // logAudit LOGIN_SUCCESS
    mockGenerateToken.mockReturnValue('jwt-linked');

    const result = await completePlexAuth(null, { pinId: 1 }, ctx);
    expect(result.token).toBe('jwt-linked');
    // Verify the UPDATE was called with plex fields
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET plex_id'),
      expect.arrayContaining(['42', 'plexbob']),
    );
  });

  it('creates new account for unknown Plex user', async () => {
    const newUser = {
      ...dbUser,
      id: 5,
      username: 'plex_plexbob',
      email: 'bob@example.com',
    };
    mockWaitForPlexAuth.mockResolvedValue('plex-token');
    mockGetPlexUser.mockResolvedValue(plexUser);
    mockHashPassword.mockResolvedValue('random-hash');
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT by plex_id — not found
      .mockResolvedValueOnce({ rows: [] }) // SELECT by email — not found
      .mockResolvedValueOnce({ rows: [newUser] }) // INSERT new user
      .mockResolvedValueOnce({ rows: [] }) // logAudit USER_CREATE
      .mockResolvedValueOnce({ rows: [] }) // UPDATE last_login_at
      .mockResolvedValueOnce({ rows: [] }) // logLoginHistory
      .mockResolvedValueOnce({ rows: [] }); // logAudit LOGIN_SUCCESS
    mockGenerateToken.mockReturnValue('jwt-new');

    const result = await completePlexAuth(null, { pinId: 1 }, ctx);
    expect(result.token).toBe('jwt-new');
    expect(result.user.username).toBe('plex_plexbob');
  });

  it('throws FORBIDDEN for disabled account', async () => {
    mockWaitForPlexAuth.mockResolvedValue('plex-token');
    mockGetPlexUser.mockResolvedValue(plexUser);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...dbUser, is_active: false }] }) // SELECT by plex_id
      .mockResolvedValueOnce({ rows: [] }); // logLoginHistory

    await expect(completePlexAuth(null, { pinId: 1 }, ctx)).rejects.toThrow('Account is disabled');
  });

  it('throws UNAUTHENTICATED on timeout', async () => {
    mockWaitForPlexAuth.mockRejectedValue(new Error('Plex authentication timed out'));
    mockQuery.mockResolvedValueOnce({ rows: [] }); // logLoginHistory

    await expect(completePlexAuth(null, { pinId: 1 }, ctx)).rejects.toThrow(
      'Plex authentication timed out or failed',
    );
  });
});

describe('Mutation.linkPlexAccount', () => {
  it('links Plex account to authenticated user', async () => {
    const ctx = authContext();
    mockWaitForPlexAuth.mockResolvedValue('plex-token');
    mockGetPlexUser.mockResolvedValue(plexUser);
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT existing by plex_id — none
      .mockResolvedValueOnce({ rows: [dbUser] }) // UPDATE RETURNING
      .mockResolvedValueOnce({ rows: [] }); // logAudit

    const result = await linkPlexAccount(null, { pinId: 1 }, ctx);
    expect(result.plex_id).toBe('42');
    expect(result.plex_username).toBe('plexbob');
  });

  it('throws UNAUTHENTICATED for anonymous user', async () => {
    await expect(linkPlexAccount(null, { pinId: 1 }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws BAD_USER_INPUT when Plex account already linked to another user', async () => {
    const ctx = authContext({ userId: 1 });
    mockWaitForPlexAuth.mockResolvedValue('plex-token');
    mockGetPlexUser.mockResolvedValue(plexUser);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] }); // plex_id belongs to user 99

    await expect(linkPlexAccount(null, { pinId: 1 }, ctx)).rejects.toThrow(
      'This Plex account is already linked to another user',
    );
  });

  it('throws BAD_USER_INPUT on timeout', async () => {
    const ctx = authContext();
    mockWaitForPlexAuth.mockRejectedValue(new Error('timeout'));

    await expect(linkPlexAccount(null, { pinId: 1 }, ctx)).rejects.toThrow(
      'Plex authentication timed out or failed',
    );
  });
});

describe('Mutation.unlinkPlexAccount', () => {
  it('unlinks Plex account from authenticated user', async () => {
    const ctx = authContext();
    const unlinked = { ...dbUser, plex_id: null, plex_username: null, plex_thumb: null };
    mockQuery
      .mockResolvedValueOnce({ rows: [unlinked] }) // UPDATE RETURNING
      .mockResolvedValueOnce({ rows: [] }); // logAudit

    const result = await unlinkPlexAccount(null, {}, ctx);
    expect(result.plex_id).toBeNull();
  });

  it('throws UNAUTHENTICATED for anonymous user', async () => {
    await expect(unlinkPlexAccount(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });
});

describe('Mutation.updateAppSetting', () => {
  it('saves an allowed setting and returns appInfo', async () => {
    const ctx = adminContext();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // logAudit

    const result = await (updateAppSetting as any)(
      null,
      { key: 'plex_client_id', value: 'my-client-id' },
      ctx,
    );
    expect(mockSetSetting).toHaveBeenCalledWith('plex_client_id', 'my-client-id');
    expect(result).toHaveProperty('isProduction');
    expect(result).toHaveProperty('plexAuthEnabled');
  });

  it('clears a setting when value is empty', async () => {
    const ctx = adminContext();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // logAudit

    await (updateAppSetting as any)(null, { key: 'tmdb_api_key', value: '' }, ctx);
    expect(mockSetSetting).toHaveBeenCalledWith('tmdb_api_key', null);
  });

  it('throws FORBIDDEN for non-admin', async () => {
    const ctx = authContext();
    await expect(
      (updateAppSetting as any)(null, { key: 'plex_client_id', value: 'x' }, ctx),
    ).rejects.toThrow('Not authorized');
  });

  it('throws FORBIDDEN for anonymous', async () => {
    await expect(
      (updateAppSetting as any)(null, { key: 'plex_client_id', value: 'x' }, anonContext()),
    ).rejects.toThrow('Not authorized');
  });

  it('throws BAD_USER_INPUT for unknown setting key', async () => {
    const ctx = adminContext();
    await expect(
      (updateAppSetting as any)(null, { key: 'unknown_key', value: 'x' }, ctx),
    ).rejects.toThrow('Unknown setting');
  });

  it('accepts all three allowed keys', async () => {
    const ctx = adminContext();
    for (const key of ['plex_client_id', 'tmdb_api_key', 'mdblist_api_key']) {
      mockSetSetting.mockClear();
      mockQuery.mockResolvedValueOnce({ rows: [] }); // logAudit
      await (updateAppSetting as any)(null, { key, value: 'test-value' }, ctx);
      expect(mockSetSetting).toHaveBeenCalledWith(key, 'test-value');
    }
  });
});
