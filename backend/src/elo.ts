import pool from './db';

const BASE_RATING = 1000;
const K_FACTOR = 32;

export function calculateElo(rA: number, rB: number, k = K_FACTOR): { newA: number; newB: number } {
  const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  return {
    newA: rA + k * (1 - eA),
    newB: rB + k * (0 - (1 - eA)),
  };
}

export async function getOrCreateElo(userId: number, movieId: number): Promise<number> {
  const res = await pool.query(
    `INSERT INTO user_movie_elo (user_id, movie_id, elo_rating, comparison_count)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (user_id, movie_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING elo_rating`,
    [userId, movieId, BASE_RATING]
  );
  return Number(res.rows[0].elo_rating);
}

export async function applyComparison(
  userId: number, winnerId: number, loserId: number
): Promise<{ winnerElo: number; loserElo: number }> {
  const [rW, rL] = await Promise.all([
    getOrCreateElo(userId, winnerId),
    getOrCreateElo(userId, loserId),
  ]);
  const { newA, newB } = calculateElo(rW, rL);

  // Update winner and loser Elo + comparison counts
  await Promise.all([
    pool.query(
      `UPDATE user_movie_elo
       SET elo_rating = $1, comparison_count = comparison_count + 1, updated_at = NOW()
       WHERE user_id = $2 AND movie_id = $3`,
      [newA, userId, winnerId]
    ),
    pool.query(
      `UPDATE user_movie_elo
       SET elo_rating = $1, comparison_count = comparison_count + 1, updated_at = NOW()
       WHERE user_id = $2 AND movie_id = $3`,
      [newB, userId, loserId]
    ),
  ]);

  // Record comparison log
  await pool.query(
    'INSERT INTO movie_comparisons (user_id, winner_id, loser_id) VALUES ($1, $2, $3)',
    [userId, winnerId, loserId]
  );

  // Recompute global elo_rank for both movies
  await Promise.all([
    updateGlobalEloRank(winnerId),
    updateGlobalEloRank(loserId),
  ]);

  return { winnerElo: newA, loserElo: newB };
}

export async function updateGlobalEloRank(movieId: number): Promise<void> {
  await pool.query(
    `UPDATE movies SET elo_rank = (
       SELECT AVG(elo_rating) FROM user_movie_elo WHERE movie_id = $1
     ) WHERE id = $1`,
    [movieId]
  );
}
