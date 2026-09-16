/* eslint-disable camelcase */
exports.shorthands = undefined;

/**
 * Append-only log of pairwise show picks. Mirrors movie_comparisons.
 * Elo pools are strictly separated per kind — no cross-kind comparisons.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('show_comparisons', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    winner_id: { type: 'integer', notNull: true, references: '"shows"', onDelete: 'CASCADE' },
    loser_id: { type: 'integer', notNull: true, references: '"shows"', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('show_comparisons', 'user_id');
  pgm.createIndex('show_comparisons', 'winner_id');
  pgm.createIndex('show_comparisons', 'loser_id');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('show_comparisons');
};
