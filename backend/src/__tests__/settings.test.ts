const mockQuery = jest.fn();
jest.mock('../db', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

import { getSetting, setSetting } from '../settings';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getSetting', () => {
  it('returns value when setting exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ value: 'my-client-id' }] });
    const result = await getSetting('plex_client_id');
    expect(result).toBe('my-client-id');
    expect(mockQuery).toHaveBeenCalledWith('SELECT value FROM app_settings WHERE key = $1', [
      'plex_client_id',
    ]);
  });

  it('returns null when setting does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await getSetting('plex_client_id');
    expect(result).toBeNull();
  });

  it('returns null when value is null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ value: null }] });
    const result = await getSetting('plex_client_id');
    expect(result).toBeNull();
  });
});

describe('setSetting', () => {
  it('upserts a value', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await setSetting('plex_client_id', 'new-id');
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app_settings'), [
      'plex_client_id',
      'new-id',
    ]);
  });

  it('clears a value by setting null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await setSetting('plex_client_id', null);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app_settings'), [
      'plex_client_id',
      null,
    ]);
  });
});
