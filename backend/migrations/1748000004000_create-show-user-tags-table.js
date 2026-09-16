/* eslint-disable camelcase */
exports.shorthands = undefined;

/**
 * Per-user, per-show tag instances. Mirrors movie_user_tags.
 * Reuses the shared `tags` definitions table — no seed rows needed
 * (the 'seen' tag is already generic).
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('show_user_tags', {
    id: 'id',
    show_id: {
      type: 'integer',
      notNull: true,
      references: '"shows"',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    tag_id: {
      type: 'integer',
      notNull: true,
      references: '"tags"',
      onDelete: 'CASCADE',
    },
    value: { type: 'text', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('show_user_tags', 'show_user_tags_unique', {
    unique: ['show_id', 'user_id', 'tag_id'],
  });

  pgm.createIndex('show_user_tags', ['show_id']);
  pgm.createIndex('show_user_tags', ['user_id']);
  pgm.createIndex('show_user_tags', ['tag_id']);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('show_user_tags');
};
