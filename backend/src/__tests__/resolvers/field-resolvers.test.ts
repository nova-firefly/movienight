import './__helpers';
import { resolvers } from '../../resolvers';

describe('Movie field resolvers', () => {
  describe('Movie.requester', () => {
    const resolver = resolvers.Movie.requester;

    it('returns user_display_name when requested_by is set', () => {
      expect(
        resolver({ requested_by: 1, user_display_name: 'Alice', user_username: 'alice' }),
      ).toBe('Alice');
    });

    it('falls back to user_username when no display_name', () => {
      expect(resolver({ requested_by: 1, user_display_name: null, user_username: 'alice' })).toBe(
        'alice',
      );
    });

    it('falls back to parent.requester when no user data', () => {
      expect(
        resolver({
          requested_by: 1,
          user_display_name: null,
          user_username: null,
          requester: 'legacy_name',
        }),
      ).toBe('legacy_name');
    });

    it('returns Unknown when nothing available', () => {
      expect(
        resolver({
          requested_by: 1,
          user_display_name: null,
          user_username: null,
          requester: null,
        }),
      ).toBe('Unknown');
    });

    it('returns parent.requester when requested_by is null', () => {
      expect(resolver({ requested_by: null, requester: 'Old User' })).toBe('Old User');
    });

    it('returns Unknown when requested_by is null and no requester', () => {
      expect(resolver({ requested_by: null, requester: null })).toBe('Unknown');
    });
  });

  describe('Movie.date_submitted', () => {
    const resolver = resolvers.Movie.date_submitted;

    it('converts Date object to ISO string', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(resolver({ date_submitted: date })).toBe('2024-01-15T12:00:00.000Z');
    });

    it('converts numeric timestamp to ISO string', () => {
      const ts = new Date('2024-01-15T12:00:00Z').getTime();
      expect(resolver({ date_submitted: ts })).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('Movie.watched_at', () => {
    const resolver = resolvers.Movie.watched_at;

    it('returns null when watched_at is null', () => {
      expect(resolver({ watched_at: null })).toBeNull();
    });

    it('returns null when watched_at is undefined', () => {
      expect(resolver({ watched_at: undefined })).toBeNull();
    });

    it('converts Date object to ISO string', () => {
      const date = new Date('2024-06-01T18:00:00Z');
      expect(resolver({ watched_at: date })).toBe('2024-06-01T18:00:00.000Z');
    });
  });

  describe('Movie.elo_rank', () => {
    const resolver = resolvers.Movie.elo_rank;

    it('returns number when present', () => {
      expect(resolver({ elo_rank: '1050.5' })).toBe(1050.5);
    });

    it('returns null when null', () => {
      expect(resolver({ elo_rank: null })).toBeNull();
    });

    it('returns null when undefined', () => {
      expect(resolver({ elo_rank: undefined })).toBeNull();
    });
  });
});

describe('User field resolvers', () => {
  describe('User.created_at', () => {
    const resolver = resolvers.User.created_at;

    it('converts Date to ISO string', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      expect(resolver({ created_at: date })).toBe('2024-01-01T00:00:00.000Z');
    });

    it('converts numeric timestamp to ISO string', () => {
      const ts = new Date('2024-01-01T00:00:00Z').getTime();
      expect(resolver({ created_at: ts })).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('User.updated_at', () => {
    const resolver = resolvers.User.updated_at;

    it('converts Date to ISO string', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      expect(resolver({ updated_at: date })).toBe('2024-06-15T12:00:00.000Z');
    });
  });

  describe('User.last_login_at', () => {
    const resolver = resolvers.User.last_login_at;

    it('returns null when not set', () => {
      expect(resolver({ last_login_at: null })).toBeNull();
    });

    it('converts Date to ISO string', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      expect(resolver({ last_login_at: date })).toBe('2024-06-15T12:00:00.000Z');
    });
  });
});

describe('AuditLog field resolvers', () => {
  describe('AuditLog.created_at', () => {
    const resolver = resolvers.AuditLog.created_at;

    it('converts Date to ISO string', () => {
      const date = new Date('2024-03-10T09:30:00Z');
      expect(resolver({ created_at: date })).toBe('2024-03-10T09:30:00.000Z');
    });
  });

  describe('AuditLog.metadata', () => {
    const resolver = resolvers.AuditLog.metadata;

    it('returns null for null metadata', () => {
      expect(resolver({ metadata: null })).toBeNull();
    });

    it('returns null for undefined metadata', () => {
      expect(resolver({ metadata: undefined })).toBeNull();
    });

    it('returns string as-is', () => {
      expect(resolver({ metadata: '{"key":"value"}' })).toBe('{"key":"value"}');
    });

    it('JSON.stringifies object metadata', () => {
      expect(resolver({ metadata: { key: 'value' } })).toBe('{"key":"value"}');
    });
  });
});

describe('LoginHistory field resolvers', () => {
  describe('LoginHistory.created_at', () => {
    const resolver = resolvers.LoginHistory.created_at;

    it('converts Date to ISO string', () => {
      const date = new Date('2024-04-20T15:45:00Z');
      expect(resolver({ created_at: date })).toBe('2024-04-20T15:45:00.000Z');
    });
  });
});
