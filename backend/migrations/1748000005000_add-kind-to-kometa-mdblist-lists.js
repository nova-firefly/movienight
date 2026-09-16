/* eslint-disable camelcase */
exports.shorthands = undefined;

/**
 * Extend kometa_mdblist_lists to be per-content-kind.
 *
 * Existing rows are all movie lists; DEFAULT 'movie' backfills them.
 * Uniqueness widens to (list_type, ref_id, environment, kind) so shows
 * lists can coexist with movie lists for the same connection/user.
 *
 * The table is small (a few rows per environment × connection), so the
 * brief lock from drop/recreate constraint is fine and matches the
 * pattern used by 1746600000000_add-environment-to-kometa-mdblist-lists.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumn('kometa_mdblist_lists', {
    kind: {
      type: 'varchar(20)',
      notNull: true,
      default: "'movie'",
    },
  });

  pgm.dropConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_env_unique');
  pgm.addConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_env_kind_unique', {
    unique: ['list_type', 'ref_id', 'environment', 'kind'],
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_env_kind_unique');
  pgm.addConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_env_unique', {
    unique: ['list_type', 'ref_id', 'environment'],
  });
  pgm.dropColumn('kometa_mdblist_lists', 'kind');
};
