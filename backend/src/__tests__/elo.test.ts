jest.mock('../db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import { calculateElo, getOrCreateElo, applyComparison, updateGlobalEloRank } from '../elo';
import pool from '../db';

const mockQuery = pool.query as jest.Mock;

describe('calculateElo', () => {
  it('equal ratings: winner gains, loser loses by equal amount', () => {
    const { newA, newB } = calculateElo(1000, 1000);
    expect(newA).toBeGreaterThan(1000);
    expect(newB).toBeLessThan(1000);
    // Zero-sum
    expect(newA + newB).toBeCloseTo(2000);
  });

  it('higher-rated beats lower-rated: smaller change', () => {
    const { newA, newB } = calculateElo(1200, 800);
    const gain = newA - 1200;
    // Expected outcome, so small gain
    expect(gain).toBeLessThan(16);
    expect(gain).toBeGreaterThan(0);
    expect(newA + newB).toBeCloseTo(2000);
  });

  it('lower-rated beats higher-rated (upset): larger change', () => {
    const { newA, newB } = calculateElo(800, 1200);
    const gain = newA - 800;
    // Upset, so large gain
    expect(gain).toBeGreaterThan(16);
    expect(newA + newB).toBeCloseTo(2000);
  });

  it('uses default K factor of 32', () => {
    const { newA } = calculateElo(1000, 1000);
    // With equal ratings, expected = 0.5, so gain = 32 * (1 - 0.5) = 16
    expect(newA - 1000).toBeCloseTo(16);
  });

  it('custom K factor changes magnitude', () => {
    const { newA: defaultK } = calculateElo(1000, 1000);
    const { newA: doubleK } = calculateElo(1000, 1000, 64);
    expect(doubleK - 1000).toBeCloseTo((defaultK - 1000) * 2);
  });

  it('extreme rating difference: changes are bounded', () => {
    const { newA, newB } = calculateElo(2000, 200);
    expect(newA - 2000).toBeGreaterThan(0);
    expect(newA - 2000).toBeLessThan(32);
    expect(newA + newB).toBeCloseTo(2200);
  });
});

describe('getOrCreateElo', () => {
  it('calls pool.query with upsert SQL and returns rating', async () => {
    mockQuery.mockResolvedValue({ rows: [{ elo_rating: '1000' }] });
    const result = await getOrCreateElo(1, 5);
    expect(result).toBe(1000);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_movie_elo'),
      [1, 5, 1000],
    );
  });
});

describe('applyComparison', () => {
  it('updates both ratings, inserts comparison, and recomputes global ranks', async () => {
    // getOrCreateElo for winner and loser
    mockQuery
      .mockResolvedValueOnce({ rows: [{ elo_rating: '1000' }] }) // winner
      .mockResolvedValueOnce({ rows: [{ elo_rating: '1000' }] }) // loser
      .mockResolvedValueOnce({ rows: [] }) // update winner
      .mockResolvedValueOnce({ rows: [] }) // update loser
      .mockResolvedValueOnce({ rows: [] }) // insert comparison
      .mockResolvedValueOnce({ rows: [] }) // updateGlobalEloRank winner
      .mockResolvedValueOnce({ rows: [] }); // updateGlobalEloRank loser

    const result = await applyComparison(1, 10, 20);
    expect(result.winnerElo).toBeGreaterThan(1000);
    expect(result.loserElo).toBeLessThan(1000);

    // Check comparison was inserted
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO movie_comparisons (user_id, winner_id, loser_id) VALUES ($1, $2, $3)',
      [1, 10, 20],
    );
  });
});

describe('updateGlobalEloRank', () => {
  it('updates movies elo_rank to average of user ratings', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await updateGlobalEloRank(5);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE movies SET elo_rank'),
      [5],
    );
  });
});
