/* eslint-disable camelcase */
// Per-season episode counts for shows (issue #107, D-21).
//
// TMDB's /tv/{id} detail returns a `seasons[]` array with `season_number` and
// `episode_count`. We store it as a JSONB map { "<season>": <episodeCount> }
// (specials/season 0 excluded) so the manual progress editor can narrow the
// Episode dropdown to the selected season's real episode count, rather than
// bounding it by the series total. Null until the show is (re)fetched from TMDB.
exports.up = (pgm) => {
  pgm.addColumns('shows', {
    season_episode_counts: { type: 'jsonb' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('shows', ['season_episode_counts']);
};
