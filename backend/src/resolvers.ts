import pool from './db';

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
  },
  Movie: {
    date_submitted: (parent: any) => {
      // Convert PostgreSQL timestamp to ISO 8601 string
      const date = parent.date_submitted instanceof Date
        ? parent.date_submitted
        : new Date(Number(parent.date_submitted));
      return date.toISOString();
    }
  }
};
