/**
 * Removes the movie_votes table. Rankings (user_movie_rankings) are now the
 * sole preference signal — yes/no voting is replaced by drag-to-rank.
 */
exports.up = (pgm) => {
  pgm.dropTable('movie_votes');
};

exports.down = (pgm) => {
  pgm.createTable('movie_votes', {
    movie_id: {
      type: 'integer',
      notNull: true,
      references: '"movies"',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    vote: { type: 'boolean', notNull: true },
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
  pgm.addConstraint('movie_votes', 'movie_votes_pkey', 'PRIMARY KEY (movie_id, user_id)');
};
