/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('movies', {
    tmdb_id: {
      type: 'integer',
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('movies', 'tmdb_id');
};
