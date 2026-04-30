/**
 * Add Plex authentication fields to users table.
 *
 * - plex_id:       The Plex account ID (unique link key)
 * - plex_username:  Display name from Plex (informational)
 * - plex_thumb:     Plex avatar URL
 */

exports.up = (pgm) => {
  pgm.addColumns('users', {
    plex_id: {
      type: 'varchar(100)',
      notNull: false,
    },
    plex_username: {
      type: 'varchar(255)',
      notNull: false,
    },
    plex_thumb: {
      type: 'text',
      notNull: false,
    },
  });

  pgm.createIndex('users', 'plex_id', {
    unique: true,
    where: 'plex_id IS NOT NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('users', 'plex_id');
  pgm.dropColumns('users', ['plex_id', 'plex_username', 'plex_thumb']);
};
