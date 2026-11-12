const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

import { createList, syncList, MdbListNotFoundError } from '../mdblist';

describe('mdblist', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('createList', () => {
    it('creates a list and returns id, slug, url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          slug: 'my-list',
          url: 'https://mdblist.com/lists/user/my-list',
        }),
      });

      const result = await createList('test-key', 'My List');

      expect(result).toEqual({
        id: 123,
        slug: 'my-list',
        url: 'https://mdblist.com/lists/user/my-list',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/lists/user/add?apikey=test-key'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My List', private: false }),
        }),
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(createList('bad-key', 'List')).rejects.toThrow(
        'MDBList create list failed (401): Unauthorized',
      );
    });
  });

  describe('syncList', () => {
    it('clears existing items and adds new ones in order', async () => {
      // getListItems — MDBList returns TMDB id under `ids.tmdb`, not top-level `tmdb`
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          movies: [
            { id: 100, ids: { tmdb: 100 } },
            { id: 200, ids: { tmdb: 200 } },
          ],
          shows: [],
        }),
      });
      // removeItems
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      // addItems
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await syncList('key', 42, [300, 400, 500]);

      // First call: GET items
      expect(mockFetch.mock.calls[0][0]).toContain('/lists/42/items?apikey=key');

      // Second call: POST remove with existing IDs
      expect(mockFetch.mock.calls[1][0]).toContain('/lists/42/items/remove');
      const removeBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(removeBody.movies).toEqual([{ tmdb: 100 }, { tmdb: 200 }]);

      // Third call: POST add with new IDs in order
      expect(mockFetch.mock.calls[2][0]).toContain('/lists/42/items/add');
      const addBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(addBody.movies).toEqual([{ tmdb: 300 }, { tmdb: 400 }, { tmdb: 500 }]);
    });

    it('skips remove when list is empty', async () => {
      // getListItems returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ movies: [], shows: [] }),
      });
      // addItems
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await syncList('key', 42, [100]);

      // Only 2 calls: GET + ADD (no remove)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('skips add when tmdbIds is empty', async () => {
      // getListItems
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ movies: [{ id: 100, ids: { tmdb: 100 } }], shows: [] }),
      });
      // removeItems
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await syncList('key', 42, []);

      // Only 2 calls: GET + REMOVE (no add)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('reads existing TMDB ids from ids.tmdb, not top-level tmdb (regression)', async () => {
      // Prior to the fix, getListItems read m.tmdb which is never populated by
      // MDBList's real response shape — leaving the sync as add-only and
      // never pruning stale items.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          movies: [
            { id: 847, ids: { tmdb: 847, imdb: 'tt0096446' } },
            { id: 274, ids: { tmdb: 274, imdb: 'tt0102926' } },
          ],
          shows: [],
        }),
      });
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await syncList('key', 1, [999]);

      const removeBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(removeBody.movies).toEqual([{ tmdb: 847 }, { tmdb: 274 }]);
    });

    it('propagates API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      });

      await expect(syncList('key', 42, [100])).rejects.toThrow(
        'MDBList get items failed (500): Server Error',
      );
    });

    it('throws MdbListNotFoundError on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '{"error":"List not found"}',
      });

      const err = await syncList('key', 42, [100]).catch((e) => e);
      expect(err).toBeInstanceOf(MdbListNotFoundError);
      expect(err.listId).toBe(42);
      expect(err.message).toBe('MDBList get items failed (404): {"error":"List not found"}');
    });

    it('throws MdbListNotFoundError when the body says the list is not found', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ movies: [], shows: [] }) });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'List not found',
      });

      await expect(syncList('key', 42, [100])).rejects.toBeInstanceOf(MdbListNotFoundError);
    });

    it('does not treat other errors as not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      });

      await expect(syncList('key', 42, [100])).rejects.not.toBeInstanceOf(MdbListNotFoundError);
    });
  });
});
