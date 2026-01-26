import pool from './db';
import { hashPassword, comparePassword, generateToken } from './auth';
import { User, CreateUserInput, UpdateUserInput } from './models/User';
import { GraphQLError } from 'graphql';

export const resolvers = {
  Query: {
    movies: async () => {
      const result = await pool.query(
        'SELECT * FROM movies ORDER BY date_submitted DESC'
      );
      return result.rows;
    },
    movie: async (_: any, { id }: { id: string }) => {
      const result = await pool.query(
        'SELECT * FROM movies WHERE id = $1',
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
        'SELECT id, username, email, is_admin, created_at, updated_at FROM users WHERE id = $1',
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
        'SELECT id, username, email, is_admin, created_at, updated_at FROM users ORDER BY created_at DESC'
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
        'SELECT id, username, email, is_admin, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0];
    },
  },
  Mutation: {
    addMovie: async (_: any, { title, requester }: { title: string; requester: string }) => {
      const result = await pool.query(
        'INSERT INTO movies (title, requester) VALUES ($1, $2) RETURNING *',
        [title, requester]
      );
      return result.rows[0];
    },
    deleteMovie: async (_: any, { id }: { id: string }) => {
      const result = await pool.query(
        'DELETE FROM movies WHERE id = $1',
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    },
    login: async (_: any, { username, password }: { username: string; password: string }) => {
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );

      const user = result.rows[0];
      if (!user) {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const userWithoutPassword: User = {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
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
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, email, is_admin, created_at, updated_at',
        [args.username, args.email, passwordHash, args.is_admin || false]
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

      if (args.username !== undefined) {
        updates.push(`username = $${paramCount++}`);
        values.push(args.username);
      }
      if (args.email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(args.email);
      }
      if (args.password !== undefined) {
        const passwordHash = await hashPassword(args.password);
        updates.push(`password_hash = $${paramCount++}`);
        values.push(passwordHash);
      }
      if (args.is_admin !== undefined) {
        updates.push(`is_admin = $${paramCount++}`);
        values.push(args.is_admin);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(args.id);

      const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, is_admin, created_at, updated_at`,
        values
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

      const result = await pool.query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    },
  },
  Movie: {
    date_submitted: (parent: any) => {
      // Convert PostgreSQL timestamp to ISO 8601 string
      const date = parent.date_submitted instanceof Date
        ? parent.date_submitted
        : new Date(Number(parent.date_submitted));
      return date.toISOString();
    }
  },
  User: {
    created_at: (parent: any) => {
      const date = parent.created_at instanceof Date
        ? parent.created_at
        : new Date(Number(parent.created_at));
      return date.toISOString();
    },
    updated_at: (parent: any) => {
      const date = parent.updated_at instanceof Date
        ? parent.updated_at
        : new Date(Number(parent.updated_at));
      return date.toISOString();
    }
  }
};
