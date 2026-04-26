import { mockQuery, authContext, adminContext, anonContext } from './__helpers';
import { resolvers } from '../../resolvers';

const { setMovieTag, removeMovieTag, unwatchMovie } = resolvers.Mutation;
const { tags, watchedMovies } = resolvers.Query;
const { myTags, userTags } = resolvers.Movie;

beforeEach(() => {
  mockQuery.mockReset();
});

// ── Query.tags ────────────────────────────────────────────────────────────────

describe('Query.tags', () => {
  it('returns all tag definitions', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, slug: 'seen', label: 'Seen it', value_type: 'boolean' }],
    });
    const result = await (tags as any)(null, {}, authContext());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: '1',
      slug: 'seen',
      label: 'Seen it',
      valueType: 'boolean',
    });
  });

  it('returns empty array when no tags exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await (tags as any)(null, {}, authContext());
    expect(result).toHaveLength(0);
  });
});

// ── Query.watchedMovies ───────────────────────────────────────────────────────

describe('Query.watchedMovies', () => {
  it('returns watched movies ordered by watched_at desc', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          title: 'Inception',
          requested_by: 1,
          watched_at: new Date('2025-01-01'),
          user_username: 'alice',
          user_display_name: 'Alice',
        },
      ],
    });
    const result = await watchedMovies(null, {}, authContext());
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Inception');
  });

  it('respects limit and offset', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await watchedMovies(null, { limit: 10, offset: 5 }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1 OFFSET $2'), [10, 5]);
  });

  it('clamps limit to 200 max', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await watchedMovies(null, { limit: 500 }, authContext());
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [200, 0]);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(watchedMovies(null, {}, anonContext())).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.setMovieTag ──────────────────────────────────────────────────────

describe('Mutation.setMovieTag', () => {
  it('creates a boolean tag on a movie', async () => {
    const now = new Date('2025-01-01');
    // 1: tag lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, slug: 'seen', label: 'Seen it', value_type: 'boolean' }],
    });
    // 2: movie lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, title: 'Inception' }] });
    // 3: upsert
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, movie_id: 5, user_id: 1, tag_id: 1, value: null, created_at: now }],
    });
    // 4: user lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'testuser', display_name: 'Test User' }],
    });
    // 5: audit log
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await setMovieTag(
      null,
      { movieId: '5', tagSlug: 'seen' },
      authContext({ userId: 1 }),
    );

    expect(result.tag.slug).toBe('seen');
    expect(result.user.username).toBe('testuser');
    expect(result.value).toBeNull();
  });

  it('creates a tag with a value', async () => {
    const now = new Date('2025-01-01');
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 2, slug: 'podcast-ep', label: 'Podcast Episode', value_type: 'number' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, title: 'Inception' }] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, movie_id: 5, user_id: 1, tag_id: 2, value: '42', created_at: now }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'testuser', display_name: 'Test' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await setMovieTag(
      null,
      { movieId: '5', tagSlug: 'podcast-ep', value: '42' },
      authContext(),
    );
    expect(result.value).toBe('42');
  });

  it('throws NOT_FOUND for unknown tag slug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      setMovieTag(null, { movieId: '5', tagSlug: 'nope' }, authContext()),
    ).rejects.toThrow('Tag not found');
  });

  it('throws NOT_FOUND for unknown movie', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, slug: 'seen', label: 'Seen it', value_type: 'boolean' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      setMovieTag(null, { movieId: '999', tagSlug: 'seen' }, authContext()),
    ).rejects.toThrow('Movie not found');
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      setMovieTag(null, { movieId: '5', tagSlug: 'seen' }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.removeMovieTag ───────────────────────────────────────────────────

describe('Mutation.removeMovieTag', () => {
  it('removes an existing tag and returns true', async () => {
    // tag lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    // movie lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, title: 'Inception' }] });
    // delete
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    // audit
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await removeMovieTag(null, { movieId: '5', tagSlug: 'seen' }, authContext());
    expect(result).toBe(true);
  });

  it('returns false when tag slug does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await removeMovieTag(null, { movieId: '5', tagSlug: 'nope' }, authContext());
    expect(result).toBe(false);
  });

  it('returns false when tag was not applied', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, title: 'Inception' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // delete found nothing
    const result = await removeMovieTag(null, { movieId: '5', tagSlug: 'seen' }, authContext());
    expect(result).toBe(false);
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(
      removeMovieTag(null, { movieId: '5', tagSlug: 'seen' }, anonContext()),
    ).rejects.toThrow('Not authenticated');
  });
});

// ── Mutation.unwatchMovie ─────────────────────────────────────────────────────

describe('Mutation.unwatchMovie', () => {
  it('clears watched_at and re-ranks the movie (owner)', async () => {
    // movie check
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 5, title: 'Inception', requested_by: 1, watched_at: new Date() }],
    });
    // update
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          title: 'Inception',
          requested_by: 1,
          watched_at: null,
          rank: 10,
          date_submitted: new Date(),
        },
      ],
    });
    // user lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ username: 'testuser', display_name: 'Test User' }],
    });
    // audit
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await unwatchMovie(null, { id: '5' }, authContext({ userId: 1 }));
    expect(result.watched_at).toBeNull();
    expect(result.id).toBe(5);
  });

  it('allows admin to unwatch any movie', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 5, title: 'Inception', requested_by: 2, watched_at: new Date() }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 5, title: 'Inception', requested_by: 2, watched_at: null, rank: 10 }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ username: 'bob', display_name: 'Bob' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await unwatchMovie(null, { id: '5' }, adminContext());
    expect(result.id).toBe(5);
  });

  it('throws NOT_FOUND for unknown movie', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(unwatchMovie(null, { id: '999' }, authContext())).rejects.toThrow(
      'Movie not found',
    );
  });

  it('throws BAD_USER_INPUT if movie is not watched', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 5, title: 'Inception', requested_by: 1, watched_at: null }],
    });
    await expect(unwatchMovie(null, { id: '5' }, authContext({ userId: 1 }))).rejects.toThrow(
      'Movie is not marked as watched',
    );
  });

  it('throws FORBIDDEN if not owner and not admin', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 5, title: 'Inception', requested_by: 2, watched_at: new Date() }],
    });
    await expect(unwatchMovie(null, { id: '5' }, authContext({ userId: 1 }))).rejects.toThrow(
      'Not authorized',
    );
  });

  it('unauthenticated throws UNAUTHENTICATED', async () => {
    await expect(unwatchMovie(null, { id: '5' }, anonContext())).rejects.toThrow(
      'Not authenticated',
    );
  });
});

// ── Movie.myTags field resolver ───────────────────────────────────────────────

describe('Movie.myTags', () => {
  it('returns tags for the current user on a movie', async () => {
    const now = new Date('2025-01-01');
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          tag_id: 1,
          slug: 'seen',
          label: 'Seen it',
          value_type: 'boolean',
          uid: 1,
          username: 'testuser',
          display_name: 'Test',
          value: null,
          created_at: now,
        },
      ],
    });
    const result = await myTags({ id: 5 }, {}, authContext());
    expect(result).toHaveLength(1);
    expect(result[0].tag.slug).toBe('seen');
  });

  it('returns empty array for unauthenticated user', async () => {
    const result = await myTags({ id: 5 }, {}, anonContext());
    expect(result).toHaveLength(0);
  });
});

// ── Movie.userTags field resolver ─────────────────────────────────────────────

describe('Movie.userTags', () => {
  it('returns all user tags for a movie', async () => {
    const now = new Date('2025-01-01');
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          tag_id: 1,
          slug: 'seen',
          label: 'Seen it',
          value_type: 'boolean',
          uid: 1,
          username: 'alice',
          display_name: 'Alice',
          value: null,
          created_at: now,
        },
        {
          tag_id: 1,
          slug: 'seen',
          label: 'Seen it',
          value_type: 'boolean',
          uid: 2,
          username: 'bob',
          display_name: 'Bob',
          value: null,
          created_at: now,
        },
      ],
    });
    const result = await (userTags as any)({ id: 5 }, {}, authContext());
    expect(result).toHaveLength(2);
    expect(result[0].user.username).toBe('alice');
    expect(result[1].user.username).toBe('bob');
  });
});
