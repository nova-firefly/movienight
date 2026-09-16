/* eslint-disable camelcase */
exports.shorthands = undefined;

/**
 * TV shows queue — parallel to movies.
 *
 * Deliberately omits two vestigial movie columns:
 *   - rank NUMERIC(20,10): deprecated post-Elo; ordering comes from user_show_elo
 *   - requester varchar(255): legacy pre-FK requester name; use requested_by FK
 *
 * TV-specific columns replace movie equivalents:
 *   release_year (text)       → first_air_year (text)
 *   director (text, scalar)   → created_by (text[], TV shows often have multiple)
 *                             + networks (text[])
 *                             + number_of_seasons, number_of_episodes, status
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('shows', {
    id: 'id',
    title: { type: 'varchar(255)', notNull: true },
    requested_by: {
      type: 'integer',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    date_submitted: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    tmdb_id: { type: 'integer', notNull: false },
    watched_at: { type: 'timestamptz', notNull: false, default: null },
    elo_rank: { type: 'numeric(10,4)', notNull: false },

    // TMDB metadata
    poster_path: { type: 'text' },
    first_air_year: { type: 'text' },
    created_by: { type: 'text[]' },
    networks: { type: 'text[]' },
    cast_list: { type: 'text[]' },
    genre_tags: { type: 'text[]' },
    number_of_seasons: { type: 'integer', notNull: false },
    number_of_episodes: { type: 'integer', notNull: false },
    status: { type: 'text', notNull: false },
    tmdb_fetched_at: { type: 'timestamptz', notNull: false },
  });

  pgm.createIndex('shows', 'requested_by');
  pgm.createIndex('shows', 'tmdb_id');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('shows');
};
