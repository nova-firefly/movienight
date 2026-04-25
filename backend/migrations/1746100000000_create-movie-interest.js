exports.up = (pgm) => {
  pgm.createTable('movie_interest', {
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
    interested: {
      type: 'boolean',
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

  pgm.addConstraint('movie_interest', 'movie_interest_pkey', {
    primaryKey: ['user_id', 'movie_id'],
  });

  pgm.createIndex('movie_interest', ['movie_id', 'interested']);
};

exports.down = (pgm) => {
  pgm.dropTable('movie_interest');
};
