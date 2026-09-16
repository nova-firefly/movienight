/* eslint-disable camelcase */
exports.shorthands = undefined;

/**
 * Per-user, per-show Elo rating. Mirrors user_movie_elo.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('user_show_elo', {
    user_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    show_id: { type: 'integer', notNull: true, references: '"shows"', onDelete: 'CASCADE' },
    elo_rating: { type: 'numeric(10,4)', notNull: true, default: 1000 },
    comparison_count: { type: 'integer', notNull: true, default: 0 },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('user_show_elo', 'user_show_elo_pkey', 'PRIMARY KEY (user_id, show_id)');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('user_show_elo');
};
