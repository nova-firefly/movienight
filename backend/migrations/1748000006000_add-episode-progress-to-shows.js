// Episode progress tracking for shows (issue #107).
//
// D-16: manual, shared/household progress — one record per show, stored as
// columns on `shows` (not a per-user table, not Plex-sourced). `next_season`/
// `next_episode` drive the "S2 · E4" EpisodeProgressChip and the in-progress-
// first ordering. A show is "in progress" when both columns are set (D-17).
// Plex-sourced (option A) or per-user (option B) progress can layer on later
// without a rewrite, since the derived GraphQL field and ordering only read
// these two columns.
exports.up = (pgm) => {
  pgm.addColumns('shows', {
    next_season: { type: 'integer' },
    next_episode: { type: 'integer' },
    progress_updated_at: { type: 'timestamptz' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('shows', ['next_season', 'next_episode', 'progress_updated_at']);
};
