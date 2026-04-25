exports.up = (pgm) => {
  pgm.addColumns('movies', {
    poster_path: { type: 'text' },
    release_year: { type: 'text' },
    director: { type: 'text' },
    cast_list: { type: 'text[]' },
    genre_tags: { type: 'text[]' },
    tmdb_fetched_at: { type: 'timestamptz' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('movies', [
    'poster_path',
    'release_year',
    'director',
    'cast_list',
    'genre_tags',
    'tmdb_fetched_at',
  ]);
};
