/**
 * Creates user_movie_rankings table for per-user fractional ranking of movies.
 * movies.rank is repurposed to cache the Borda count score (higher = more wanted).
 */
exports.up = (pgm) => {
  pgm.createTable('user_movie_rankings', {
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    movie_id: {
      type: 'integer',
      notNull: true,
      references: '"movies"',
      onDelete: 'CASCADE',
    },
    rank: {
      type: 'numeric(20,10)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
  pgm.addConstraint(
    'user_movie_rankings',
    'user_movie_rankings_pkey',
    'PRIMARY KEY (user_id, movie_id)'
  );
  pgm.addIndex('user_movie_rankings', ['user_id', 'rank']);

  // Reset movies.rank to 0 (Borda score) — no user rankings exist yet
  pgm.sql('UPDATE movies SET rank = 0');
};

exports.down = (pgm) => {
  pgm.dropTable('user_movie_rankings');
};
