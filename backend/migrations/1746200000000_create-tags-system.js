/**
 * Per-User Movie Tag System
 *
 * Creates a generic, extensible tagging framework for movies:
 *
 *   tags             – Tag definitions (slug, label, value type)
 *   movie_user_tags  – Per-user, per-movie tag instances with optional value
 *
 * ## How it works
 *
 *   - Each tag has a `slug` (unique key), `label` (display name), and
 *     `value_type` ('boolean' | 'number' | 'text').
 *   - Boolean tags (like "seen") only need a row to exist — no value column needed.
 *   - Number/text tags store their payload in the `value` column.
 *   - Tags are per-user: Alice can tag Inception as "seen" independently of Bob.
 *
 * ## Seeded tags
 *
 *   slug: 'seen', label: 'Seen it', type: 'boolean'
 *     → "I've personally watched this movie before"
 *
 * ## Adding new tags later
 *
 *   INSERT INTO tags (slug, label, value_type) VALUES ('podcast-ep', 'Podcast Episode', 'number');
 *
 *   Then users can tag movies:
 *   INSERT INTO movie_user_tags (movie_id, user_id, tag_id, value)
 *   VALUES (42, 1, (SELECT id FROM tags WHERE slug = 'podcast-ep'), '137');
 */

exports.up = (pgm) => {
  // Tag definitions
  pgm.createTable('tags', {
    id: 'id',
    slug: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    label: {
      type: 'varchar(100)',
      notNull: true,
    },
    value_type: {
      type: 'varchar(20)',
      notNull: true,
      default: "'boolean'",
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Per-user, per-movie tag instances
  pgm.createTable('movie_user_tags', {
    id: 'id',
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
    tag_id: {
      type: 'integer',
      notNull: true,
      references: '"tags"',
      onDelete: 'CASCADE',
    },
    value: {
      type: 'text',
      notNull: false,
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

  pgm.addConstraint('movie_user_tags', 'movie_user_tags_unique', {
    unique: ['movie_id', 'user_id', 'tag_id'],
  });

  pgm.createIndex('movie_user_tags', ['movie_id']);
  pgm.createIndex('movie_user_tags', ['user_id']);
  pgm.createIndex('movie_user_tags', ['tag_id']);

  // Seed the first tag
  pgm.sql(`INSERT INTO tags (slug, label, value_type) VALUES ('seen', 'Seen it', 'boolean')`);
};

exports.down = (pgm) => {
  pgm.dropTable('movie_user_tags');
  pgm.dropTable('tags');
};
