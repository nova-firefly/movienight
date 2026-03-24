exports.up = (pgm) => {
  // Allow requester text to be null so new movies only need the FK
  pgm.alterColumn('movies', 'requester', { notNull: false });

  pgm.addColumn('movies', {
    requested_by: {
      type: 'integer',
      references: '"users"',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('movies', 'requested_by');

  // Backfill FK from username match for existing rows
  pgm.sql(`
    UPDATE movies m
    SET requested_by = u.id
    FROM users u
    WHERE u.username = m.requester
  `);
};

exports.down = (pgm) => {
  // Restore requester text from user data before dropping the FK column
  pgm.sql(`
    UPDATE movies m
    SET requester = COALESCE(u.display_name, u.username)
    FROM users u
    WHERE m.requested_by = u.id AND m.requester IS NULL
  `);
  pgm.dropIndex('movies', 'requested_by');
  pgm.dropColumn('movies', 'requested_by');
  pgm.alterColumn('movies', 'requester', { notNull: true });
};
