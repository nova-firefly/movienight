import pool from './db';
import type { Kind } from './contentActions';

const BASE_RATING = 1000;
const K_FACTOR = 32;

// Table/column names are interpolated into SQL below. They come *only* from
// these closed Record<Kind, string> maps keyed by the union type — never from
// user input. Every value stays parameterised ($1, $2, …). Keep it that way.
const ELO_TABLE: Record<Kind, string> = {
  movie: 'user_movie_elo',
  show: 'user_show_elo',
};
const ELO_ID_COLUMN: Record<Kind, string> = {
  movie: 'movie_id',
  show: 'show_id',
};
const COMPARISONS_TABLE: Record<Kind, string> = {
  movie: 'movie_comparisons',
  show: 'show_comparisons',
};
const CONTENT_TABLE: Record<Kind, string> = {
  movie: 'movies',
  show: 'shows',
};

export function calculateElo(rA: number, rB: number, k = K_FACTOR): { newA: number; newB: number } {
  const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  return {
    newA: rA + k * (1 - eA),
    newB: rB + k * (0 - (1 - eA)),
  };
}

export async function getOrCreateElo(
  kind: Kind,
  userId: number,
  contentId: number,
): Promise<number> {
  const table = ELO_TABLE[kind];
  const idCol = ELO_ID_COLUMN[kind];
  const res = await pool.query(
    `INSERT INTO ${table} (user_id, ${idCol}, elo_rating, comparison_count)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (user_id, ${idCol}) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING elo_rating`,
    [userId, contentId, BASE_RATING],
  );
  return Number(res.rows[0].elo_rating);
}

export async function applyComparison(
  kind: Kind,
  userId: number,
  winnerId: number,
  loserId: number,
): Promise<{ winnerElo: number; loserElo: number }> {
  const table = ELO_TABLE[kind];
  const idCol = ELO_ID_COLUMN[kind];
  const comparisonsTable = COMPARISONS_TABLE[kind];

  const [rW, rL] = await Promise.all([
    getOrCreateElo(kind, userId, winnerId),
    getOrCreateElo(kind, userId, loserId),
  ]);
  const { newA, newB } = calculateElo(rW, rL);

  // Update winner and loser Elo + comparison counts
  await Promise.all([
    pool.query(
      `UPDATE ${table}
       SET elo_rating = $1, comparison_count = comparison_count + 1, updated_at = NOW()
       WHERE user_id = $2 AND ${idCol} = $3`,
      [newA, userId, winnerId],
    ),
    pool.query(
      `UPDATE ${table}
       SET elo_rating = $1, comparison_count = comparison_count + 1, updated_at = NOW()
       WHERE user_id = $2 AND ${idCol} = $3`,
      [newB, userId, loserId],
    ),
  ]);

  // Record comparison log
  await pool.query(
    `INSERT INTO ${comparisonsTable} (user_id, winner_id, loser_id) VALUES ($1, $2, $3)`,
    [userId, winnerId, loserId],
  );

  // Recompute global elo_rank for both items
  await Promise.all([updateGlobalEloRank(kind, winnerId), updateGlobalEloRank(kind, loserId)]);

  return { winnerElo: newA, loserElo: newB };
}

export async function updateGlobalEloRank(kind: Kind, contentId: number): Promise<void> {
  const contentTable = CONTENT_TABLE[kind];
  const eloTable = ELO_TABLE[kind];
  const idCol = ELO_ID_COLUMN[kind];
  await pool.query(
    `UPDATE ${contentTable} SET elo_rank = (
       SELECT AVG(elo_rating) FROM ${eloTable} WHERE ${idCol} = $1
     ) WHERE id = $1`,
    [contentId],
  );
}
