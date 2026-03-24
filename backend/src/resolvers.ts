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
    addMovie: async (_: any, { title }: { title: string }, context: any) => {
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
        'INSERT INTO movies (title, requested_by, rank) VALUES ($1, $2, $3) RETURNING *',
        [title, context.user.userId, newRank]
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
    moveMovie: async (_: any, { id, direction }: { id: string; direction: string }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      if (direction !== 'up' && direction !== 'down') {
        throw new GraphQLError('direction must be "up" or "down"', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const currentResult = await pool.query('SELECT id, title, rank FROM movies WHERE id = $1', [id]);
      if (currentResult.rows.length === 0) {
        throw new GraphQLError('Movie not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      const current = currentResult.rows[0];

      // Find adjacent movie in the requested direction
      const adjacentResult = await pool.query(
        direction === 'up'
          ? 'SELECT id, rank FROM movies WHERE rank < $1 ORDER BY rank DESC LIMIT 1'
          : 'SELECT id, rank FROM movies WHERE rank > $1 ORDER BY rank ASC LIMIT 1',
        [current.rank]
      );
      if (adjacentResult.rows.length === 0) {
        // Already at the boundary, nothing to do
        return false;
      }
      const adjacent = adjacentResult.rows[0];

      // Swap ranks
      await pool.query('UPDATE movies SET rank = $1 WHERE id = $2', [adjacent.rank, current.id]);
      await pool.query('UPDATE movies SET rank = $1 WHERE id = $2', [current.rank, adjacent.id]);

      await logAudit(
        context.user.userId,
        'MOVIE_REORDER',
        'movie',
        String(current.id),
        { title: current.title, direction },
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
