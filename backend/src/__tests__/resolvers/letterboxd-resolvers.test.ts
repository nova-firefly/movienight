import {
  mockQuery,
  mockFetch,
  mockGetSetting,
  adminContext,
  authContext,
  anonContext,
} from './__helpers';
import { resolvers } from '../../resolvers';

const { importFromLetterboxd } = resolvers.Mutation;

beforeEach(() => {
  mockGetSetting.mockResolvedValue(null);
});

describe('Mutation.importFromLetterboxd', () => {
  describe('authorization', () => {
    it('non-admin throws FORBIDDEN', async () => {
      await expect(
        importFromLetterboxd(null, { url: 'https://letterboxd.com/user/list/x/' }, authContext()),
      ).rejects.toThrow('Not authorized');
    });

    it('unauthenticated throws FORBIDDEN', async () => {
      await expect(
        importFromLetterboxd(null, { url: 'https://letterboxd.com/user/list/x/' }, anonContext()),
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('URL validation', () => {
    it('invalid URL throws BAD_USER_INPUT', async () => {
      await expect(
        importFromLetterboxd(null, { url: 'not-a-url' }, adminContext()),
      ).rejects.toThrow('Invalid URL');
    });

    it('non-letterboxd hostname throws BAD_USER_INPUT', async () => {
      await expect(
        importFromLetterboxd(null, { url: 'https://evil.com/list/x/' }, adminContext()),
      ).rejects.toThrow('URL must be a letterboxd.com list');
    });

    it('www.letterboxd.com is accepted', async () => {
      const html = '<div data-item-name="Test Movie (2024)"></div>';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => html,
      });
      // Second page returns 404 to stop pagination
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Existing movies query
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // INSERT for the movie
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // logAudit
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await importFromLetterboxd(
        null,
        { url: 'https://www.letterboxd.com/user/list/test/' },
        adminContext(),
      );
      expect(result.imported).toBe(1);
    });
  });

  describe('HTML parsing', () => {
    it('parses data-item-name attributes with year', async () => {
      const html =
        '<div data-item-name="Inception (2010)"></div>' +
        '<div data-item-name="Parasite (2019)"></div>';
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => html })
        .mockResolvedValueOnce({ ok: false, status: 404 });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // existing movies
      mockQuery.mockResolvedValue({ rows: [] }); // INSERTs + logAudit

      const result = await importFromLetterboxd(
        null,
        { url: 'https://letterboxd.com/user/list/x/' },
        adminContext(),
      );
      expect(result.imported).toBe(2);
    });

    it('handles titles without year', async () => {
      const html = '<div data-item-name="Some Movie"></div>';
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => html })
        .mockResolvedValueOnce({ ok: false, status: 404 });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await importFromLetterboxd(
        null,
        { url: 'https://letterboxd.com/user/list/x/' },
        adminContext(),
      );
      expect(result.imported).toBe(1);
    });

    it('decodes HTML entities', async () => {
      const html = '<div data-item-name="Rock &amp; Roll (2020)"></div>';
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => html })
        .mockResolvedValueOnce({ ok: false, status: 404 });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await importFromLetterboxd(
        null,
        { url: 'https://letterboxd.com/user/list/x/' },
        adminContext(),
      );
      expect(result.imported).toBe(1);
      // Verify the INSERT was called with decoded title
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO movies'), [
        'Rock & Roll',
        expect.any(Number),
        null,
      ]);
    });

    it('stops pagination on 404', async () => {
      const html = '<div data-item-name="Movie A (2020)"></div>';
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => html })
        .mockResolvedValueOnce({ ok: false, status: 404 }); // page 2 = 404
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValue({ rows: [] });

      await importFromLetterboxd(
        null,
        { url: 'https://letterboxd.com/user/list/x/' },
        adminContext(),
      );
      // Should only fetch 2 times (page 1 + page 2 = 404)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('deduplication', () => {
    it('skips movies that already exist (case-insensitive)', async () => {
      const html = '<div data-item-name="Inception (2010)"></div>';
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => html })
        .mockResolvedValueOnce({ ok: false, status: 404 });
      mockQuery.mockResolvedValueOnce({ rows: [{ title: 'inception' }] }); // existing
      mockQuery.mockResolvedValue({ rows: [] }); // logAudit

      const result = await importFromLetterboxd(
        null,
        { url: 'https://letterboxd.com/user/list/x/' },
        adminContext(),
      );
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('error handling', () => {
    it('fetch failure returns errors array', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockQuery.mockResolvedValueOnce({ rows: [] }); // existing movies check isn't reached
      mockQuery.mockResolvedValue({ rows: [] }); // logAudit

      const result = await importFromLetterboxd(
        null,
        { url: 'https://letterboxd.com/user/list/x/' },
        adminContext(),
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('no films found returns error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html><body>No films here</body></html>',
      });
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await importFromLetterboxd(
        null,
        { url: 'https://letterboxd.com/user/list/x/' },
        adminContext(),
      );
      expect(result.errors).toContain(
        'No films found — check that the URL is a public Letterboxd list',
      );
    });
  });
});
