/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Add rank column with high precision NUMERIC type
  pgm.addColumn('movies', {
    rank: {
      type: 'numeric(20, 10)',
      notNull: true,
      default: 0,
    },
  });

  // Create index on rank for efficient sorting
  pgm.createIndex('movies', 'rank');

  // Assign random rankings to existing movies
  // This SQL will give each existing movie a unique sequential rank
  pgm.sql(`
    UPDATE movies
    SET rank = sub.row_num
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY RANDOM()) as row_num
      FROM movies
    ) AS sub
    WHERE movies.id = sub.id
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropIndex('movies', 'rank');
  pgm.dropColumn('movies', 'rank');
};
