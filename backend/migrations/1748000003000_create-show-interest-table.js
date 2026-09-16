/* eslint-disable camelcase */
exports.shorthands = undefined;

/**
 * Per-user interest (pass/skip) flag on shows. Mirrors movie_interest.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('show_interest', {
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    show_id: {
      type: 'integer',
      notNull: true,
      references: '"shows"',
      onDelete: 'CASCADE',
    },
    interested: { type: 'boolean', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('show_interest', 'show_interest_pkey', {
    primaryKey: ['user_id', 'show_id'],
  });

  pgm.createIndex('show_interest', ['show_id', 'interested']);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('show_interest');
};
