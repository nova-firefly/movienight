import pool from './db';
import { hashPassword, comparePassword, generateToken } from './auth';
import { User, CreateUserInput, UpdateUserInput } from './models/User';
import { GraphQLError } from 'graphql';

const USER_COLS =
  'id, username, email, display_name, is_admin, is_active, last_login_at, created_at, updated_at';

async function logAudit(
  actorId: number | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: object | null,
  ipAddress: string
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [actorId, action, targetType, targetId, metadata, ipAddress]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

async function logLoginHistory(
  userId: number | null,
  ipAddress: string,
  userAgent: string,
  succeeded: boolean
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent, succeeded) VALUES ($1, $2, $3, $4)',
      [userId, ipAddress, userAgent, succeeded]
    );
  } catch (err) {
    console.error('Failed to write login history:', err);
  }
}

export const resolvers = {
  Query: {
    searchTmdb: async (_: any, { query }: { query: string }) => {
      const apiKey = process.env.TMDB_API_KEY;
      if (!apiKey) {
        throw new GraphQLError('TMDB API key not configured', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new GraphQLError('TMDB search failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
      const data = await response.json() as any;
      return (data.results as any[]).slice(0, 10).map((movie: any) => ({
        tmdb_id: movie.id,
        title: movie.title,
        release_year: movie.release_date ? movie.release_date.split('-')[0] : null,
        overview: movie.overview || null,
      }));
    },
    movies: async () => {
      const result = await pool.query(
        `SELECT m.*, u.username AS user_username, u.display_name AS user_display_name
         FROM movies m
         LEFT JOIN users u ON m.requested_by = u.id
         ORDER BY m.rank ASC`
      );
      return result.rows;
    },
    movie: async (_: any, { id }: { id: string }) => {
      const result = await pool.query(
        `SELECT m.*, u.username AS user_username, u.display_name AS user_display_name
         FROM movies m
         LEFT JOIN users u ON m.requested_by = u.id
         WHERE m.id = $1`,
        [id]
      );
      return result.rows[0];
    },
    me: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      const result = await pool.query(
        `SELECT ${USER_COLS} FROM users WHERE id = $1`,
        [context.user.userId]
      );
      return result.rows[0];
    },
    users: async (_: any, __: any, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query(
        `SELECT ${USER_COLS} FROM users ORDER BY created_at DESC`
      );
      return result.rows;
    },
    user: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query(
        `SELECT ${USER_COLS} FROM users WHERE id = $1`,
        [id]
      );
      return result.rows[0];
    },
    auditLogs: async (
      _: any,
      { limit = 100, offset = 0 }: { limit?: number; offset?: number },
      context: any
    ) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query(
        `SELECT al.id, al.actor_id, u.username AS actor_username, al.action,
                al.target_type, al.target_id, al.metadata, al.ip_address, al.created_at
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         ORDER BY al.created_at DESC
         LIMIT $1 OFFSET $2`,
        [Math.min(limit, 500), offset]
      );
      return result.rows;
    },
    loginHistory: async (
      _: any,
      { userId, limit = 100 }: { userId?: string; limit?: number },
      context: any
    ) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const cap = Math.min(limit, 500);
      if (userId) {
        const result = await pool.query(
          `SELECT lh.id, lh.user_id, u.username, lh.ip_address, lh.user_agent,
                  lh.succeeded, lh.created_at
           FROM login_history lh
           LEFT JOIN users u ON lh.user_id = u.id
           WHERE lh.user_id = $1
           ORDER BY lh.created_at DESC
           LIMIT $2`,
          [userId, cap]
        );
        return result.rows;
      }
      const result = await pool.query(
        `SELECT lh.id, lh.user_id, u.username, lh.ip_address, lh.user_agent,
                lh.succeeded, lh.created_at
         FROM login_history lh
         LEFT JOIN users u ON lh.user_id = u.id
         ORDER BY lh.created_at DESC
         LIMIT $1`,
        [cap]
      );
      return result.rows;
    },
  },
  Mutation: {
    addMovie: async (_: any, { title, tmdb_id }: { title: string; tmdb_id?: number }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      const maxRankResult = await pool.query(
        'SELECT COALESCE(MAX(rank), 0) as max_rank FROM movies'
      );
      const newRank = Number(maxRankResult.rows[0].max_rank) + 1;
      const insertResult = await pool.query(
        'INSERT INTO movies (title, requested_by, rank, tmdb_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, context.user.userId, newRank, tmdb_id ?? null]
      );
      const userRow = await pool.query(
        'SELECT username, display_name FROM users WHERE id = $1',
        [context.user.userId]
      );
      const requesterName =
        userRow.rows[0]?.display_name || userRow.rows[0]?.username || context.user.username;
      await logAudit(
        context.user.userId,
        'MOVIE_ADD',
        'movie',
        String(insertResult.rows[0].id),
        { title, requester: requesterName },
        context.ipAddress
      );
      return {
        ...insertResult.rows[0],
        user_username: userRow.rows[0]?.username,
        user_display_name: userRow.rows[0]?.display_name,
      };
    },
    deleteMovie: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const movieResult = await pool.query('SELECT title FROM movies WHERE id = $1', [id]);
      const movie = movieResult.rows[0];
      const result = await pool.query('DELETE FROM movies WHERE id = $1', [id]);
      if ((result.rowCount ?? 0) > 0) {
        await logAudit(
          context.user.userId,
          'MOVIE_DELETE',
          'movie',
          id,
          movie ? { title: movie.title } : null,
          context.ipAddress ?? 'unknown'
        );
      }
      return (result.rowCount ?? 0) > 0;
    },
    reorderMovie: async (_: any, { id, afterId }: { id: string; afterId?: string | null }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const currentResult = await pool.query('SELECT id, title, rank FROM movies WHERE id = $1', [id]);
      if (currentResult.rows.length === 0) {
        throw new GraphQLError('Movie not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      const current = currentResult.rows[0];

      // Fetch all other movies ordered by rank to compute new rank via fractional indexing
      const othersResult = await pool.query(
        'SELECT id, rank FROM movies WHERE id != $1 ORDER BY rank ASC',
        [id]
      );
      const others = othersResult.rows;

      let newRank: number;
      if (!afterId) {
        // Move to the very beginning
        const first = others[0];
        newRank = first ? Number(first.rank) / 2 : 1;
      } else {
        const afterIndex = others.findIndex((m: any) => String(m.id) === String(afterId));
        if (afterIndex === -1) {
          throw new GraphQLError('afterId not found', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        const afterRank = Number(others[afterIndex].rank);
        const nextItem = others[afterIndex + 1];
        newRank = nextItem ? (afterRank + Number(nextItem.rank)) / 2 : afterRank + 1;
      }

      await pool.query('UPDATE movies SET rank = $1 WHERE id = $2', [newRank, id]);

      await logAudit(
        context.user.userId,
        'MOVIE_REORDER',
        'movie',
        String(current.id),
        { title: current.title, afterId: afterId ?? null },
        context.ipAddress ?? 'unknown'
      );
      return true;
    },
    login: async (
      _: any,
      { username, password }: { username: string; password: string },
      context: any
    ) => {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = result.rows[0];

      if (!user) {
        await logLoginHistory(null, context.ipAddress, context.userAgent, false);
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        await logLoginHistory(user.id, context.ipAddress, context.userAgent, false);
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!user.is_active) {
        await logLoginHistory(user.id, context.ipAddress, context.userAgent, false);
        throw new GraphQLError('Account is disabled', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
      await logLoginHistory(user.id, context.ipAddress, context.userAgent, true);
      await logAudit(user.id, 'LOGIN_SUCCESS', null, null, null, context.ipAddress);

      const userWithoutPassword: User = {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        is_admin: user.is_admin,
        is_active: user.is_active,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      const token = generateToken(userWithoutPassword);
      return { token, user: userWithoutPassword };
    },
    createUser: async (_: any, args: CreateUserInput, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const passwordHash = await hashPassword(args.password);
      const isActive = args.is_active !== false;
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${USER_COLS}`,
        [
          args.username,
          args.email,
          passwordHash,
          args.display_name || null,
          args.is_admin || false,
          isActive,
        ]
      );
      await logAudit(
        context.user.userId,
        'USER_CREATE',
        'user',
        String(result.rows[0].id),
        { username: args.username, email: args.email, is_admin: args.is_admin || false },
        context.ipAddress
      );
      return result.rows[0];
    },
    updateUser: async (_: any, args: UpdateUserInput, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      const changes: Record<string, any> = {};

      if (args.username !== undefined) {
        updates.push(`username = $${paramCount++}`);
        values.push(args.username);
        changes.username = args.username;
      }
      if (args.email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(args.email);
        changes.email = args.email;
      }
      if (args.password !== undefined) {
        const passwordHash = await hashPassword(args.password);
        updates.push(`password_hash = $${paramCount++}`);
        values.push(passwordHash);
        changes.password = '[changed]';
      }
      if (args.display_name !== undefined) {
        updates.push(`display_name = $${paramCount++}`);
        values.push(args.display_name || null);
        changes.display_name = args.display_name;
      }
      if (args.is_admin !== undefined) {
        updates.push(`is_admin = $${paramCount++}`);
        values.push(args.is_admin);
        changes.is_admin = args.is_admin;
      }
      if (args.is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(args.is_active);
        changes.is_active = args.is_active;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(args.id);

      const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING ${USER_COLS}`,
        values
      );
      await logAudit(
        context.user.userId,
        'USER_UPDATE',
        'user',
        String(args.id),
        changes,
        context.ipAddress
      );
      return result.rows[0];
    },
    deleteUser: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      if (context.user.userId === parseInt(id)) {
        throw new GraphQLError('Cannot delete your own account', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const targetResult = await pool.query(
        'SELECT username, email FROM users WHERE id = $1',
        [id]
      );
      const targetUser = targetResult.rows[0];

      const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
      if ((result.rowCount ?? 0) > 0 && targetUser) {
        await logAudit(
          context.user.userId,
          'USER_DELETE',
          'user',
          id,
          { username: targetUser.username, email: targetUser.email },
          context.ipAddress
        );
      }
      return (result.rowCount ?? 0) > 0;
    },
  },
  Movie: {
    requester: (parent: any) => {
      if (parent.requested_by != null) {
        return parent.user_display_name || parent.user_username || parent.requester || 'Unknown';
      }
      return parent.requester || 'Unknown';
    },
    date_submitted: (parent: any) => {
      const date =
        parent.date_submitted instanceof Date
          ? parent.date_submitted
          : new Date(Number(parent.date_submitted));
      return date.toISOString();
    },
  },
  User: {
    created_at: (parent: any) => {
      const date =
        parent.created_at instanceof Date
          ? parent.created_at
          : new Date(Number(parent.created_at));
      return date.toISOString();
    },
    updated_at: (parent: any) => {
      const date =
        parent.updated_at instanceof Date
          ? parent.updated_at
          : new Date(Number(parent.updated_at));
      return date.toISOString();
    },
    last_login_at: (parent: any) => {
      if (!parent.last_login_at) return null;
      const date =
        parent.last_login_at instanceof Date
          ? parent.last_login_at
          : new Date(Number(parent.last_login_at));
      return date.toISOString();
    },
  },
  AuditLog: {
    created_at: (parent: any) => {
      const date =
        parent.created_at instanceof Date
          ? parent.created_at
          : new Date(Number(parent.created_at));
      return date.toISOString();
    },
    metadata: (parent: any) => {
      if (parent.metadata === null || parent.metadata === undefined) return null;
      return typeof parent.metadata === 'string'
        ? parent.metadata
        : JSON.stringify(parent.metadata);
    },
  },
  LoginHistory: {
    created_at: (parent: any) => {
      const date =
        parent.created_at instanceof Date
          ? parent.created_at
          : new Date(Number(parent.created_at));
      return date.toISOString();
    },
  },
};
