exports.up = (pgm) => {
  // Global Elo average cache
  pgm.addColumn('movies', {
    elo_rank: { type: 'numeric(10,4)', notNull: false },
  });

  // Append-only log of every pairwise pick
  pgm.createTable('movie_comparisons', {
    id:         { type: 'serial', primaryKey: true },
    user_id:    { type: 'integer', notNull: true, references: '"users"',  onDelete: 'CASCADE' },
    winner_id:  { type: 'integer', notNull: true, references: '"movies"', onDelete: 'CASCADE' },
    loser_id:   { type: 'integer', notNull: true, references: '"movies"', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('movie_comparisons', 'user_id');
  pgm.createIndex('movie_comparisons', 'winner_id');
  pgm.createIndex('movie_comparisons', 'loser_id');

  // Per-user, per-movie Elo rating
  pgm.createTable('user_movie_elo', {
    user_id:          { type: 'integer', notNull: true, references: '"users"',  onDelete: 'CASCADE' },
    movie_id:         { type: 'integer', notNull: true, references: '"movies"', onDelete: 'CASCADE' },
    elo_rating:       { type: 'numeric(10,4)', notNull: true, default: 1000 },
    comparison_count: { type: 'integer', notNull: true, default: 0 },
    updated_at:       { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('user_movie_elo', 'user_movie_elo_pkey', 'PRIMARY KEY (user_id, movie_id)');

  // Drop drag-to-rank table (data is intentionally discarded)
  pgm.dropTable('user_movie_rankings');

  // movies.rank is left in place but is no longer written to or read from.
};

exports.down = (pgm) => {
  pgm.dropTable('user_movie_elo');
  pgm.dropTable('movie_comparisons');
  pgm.dropColumn('movies', 'elo_rank');
  pgm.createTable('user_movie_rankings', {
    user_id:    { type: 'integer', notNull: true, references: '"users"',  onDelete: 'CASCADE' },
    movie_id:   { type: 'integer', notNull: true, references: '"movies"', onDelete: 'CASCADE' },
    rank:       { type: 'numeric(20,10)', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('user_movie_rankings', 'user_movie_rankings_pkey', 'PRIMARY KEY (user_id, movie_id)');
  pgm.createIndex('user_movie_rankings', ['user_id', 'rank']);
};
