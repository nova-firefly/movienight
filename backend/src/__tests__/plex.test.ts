const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

import { createPlexPin, checkPlexPin, getPlexUser, getPlexAuthUrl, waitForPlexAuth } from '../plex';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createPlexPin', () => {
  it('calls POST /pins and returns parsed response', async () => {
    const pin = { id: 123, code: 'abc123', authToken: null };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(pin) });

    const result = await createPlexPin();
    expect(result).toEqual(pin);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://plex.tv/api/v2/pins',
      expect.objectContaining({ method: 'POST', body: 'strong=true' }),
    );
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(createPlexPin()).rejects.toThrow('Plex PIN creation failed: 500');
  });
});

describe('checkPlexPin', () => {
  it('calls GET /pins/:id and returns parsed response', async () => {
    const pin = { id: 123, code: 'abc123', authToken: 'tok' };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(pin) });

    const result = await checkPlexPin(123);
    expect(result).toEqual(pin);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://plex.tv/api/v2/pins/123',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
    );
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(checkPlexPin(999)).rejects.toThrow('Plex PIN check failed: 404');
  });
});

describe('getPlexUser', () => {
  it('calls GET /user with X-Plex-Token header', async () => {
    const user = { id: 42, uuid: 'u', username: 'bob', email: 'bob@example.com', thumb: '' };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(user) });

    const result = await getPlexUser('my-token');
    expect(result).toEqual(user);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://plex.tv/api/v2/user',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'my-token' }),
      }),
    );
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(getPlexUser('bad')).rejects.toThrow('Plex user fetch failed: 401');
  });
});

describe('getPlexAuthUrl', () => {
  it('returns correctly formatted URL with code', () => {
    const url = getPlexAuthUrl('test-code');
    expect(url).toContain('https://app.plex.tv/auth#?');
    expect(url).toContain('code=test-code');
    expect(url).toContain('context%5Bdevice%5D%5Bproduct%5D=MovieNight');
  });
});

describe('waitForPlexAuth', () => {
  it('returns authToken when PIN becomes authenticated', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, code: 'c', authToken: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, code: 'c', authToken: 'got-it' }),
      });

    const token = await waitForPlexAuth(1, 10_000, 10);
    expect(token).toBe('got-it');
  });

  it('throws on timeout', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, code: 'c', authToken: null }),
    });

    await expect(waitForPlexAuth(1, 50, 10)).rejects.toThrow('Plex authentication timed out');
  });
});
