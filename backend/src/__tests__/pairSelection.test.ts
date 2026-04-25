import { selectPair, MovieCandidate } from '../pairSelection';

function makeCandidate(overrides: Partial<MovieCandidate> & { id: number }): MovieCandidate {
  return {
    title: `Movie ${overrides.id}`,
    tmdb_id: null,
    userComparisonCount: 0,
    elo_rating: 1000,
    ...overrides,
  };
}

describe('selectPair', () => {
  let randomSpy: jest.SpyInstance;

  beforeEach(() => {
    randomSpy = jest.spyOn(Math, 'random');
  });

  describe('error handling', () => {
    it('throws for empty array', () => {
      expect(() => selectPair([])).toThrow('Not enough movies');
    });

    it('throws for single-element array', () => {
      expect(() => selectPair([makeCandidate({ id: 1 })])).toThrow('Not enough movies');
    });
  });

  describe('basic pair selection (2 movies)', () => {
    it('returns both movies in the pair', () => {
      randomSpy.mockReturnValue(0.5);
      const movies = [makeCandidate({ id: 1 }), makeCandidate({ id: 2 })];
      const [first, second] = selectPair(movies);
      const ids = [first.id, second.id].sort();
      expect(ids).toEqual([1, 2]);
    });

    it('returned pair contains two different movies', () => {
      randomSpy.mockReturnValue(0.5);
      const movies = [makeCandidate({ id: 1 }), makeCandidate({ id: 2 })];
      const [first, second] = selectPair(movies);
      expect(first.id).not.toBe(second.id);
    });
  });

  describe('Tier 1: IFW first pick favors fewer comparisons', () => {
    it('with Math.random = 0, picks first item in array', () => {
      // weightedRandomPick: r = Math.random() * total. When random=0, r=0.
      // Loop: r -= weight[0] => r < 0, returns items[0].
      // So place the fewest-comparison movie first to verify IFW weighting.
      randomSpy.mockReturnValue(0);
      const movies = [
        makeCandidate({ id: 2, userComparisonCount: 0 }),
        makeCandidate({ id: 1, userComparisonCount: 10 }),
        makeCandidate({ id: 3, userComparisonCount: 5 }),
      ];
      const [first] = selectPair(movies);
      expect(first.id).toBe(2);
    });

    it('statistically favors movies with fewer comparisons', () => {
      randomSpy.mockRestore();
      const movies = [
        makeCandidate({ id: 1, userComparisonCount: 100 }),
        makeCandidate({ id: 2, userComparisonCount: 0 }),
        makeCandidate({ id: 3, userComparisonCount: 100 }),
      ];
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      for (let i = 0; i < 200; i++) {
        const [first] = selectPair(movies);
        counts[first.id]++;
      }
      // id=2 should be picked significantly more often
      expect(counts[2]).toBeGreaterThan(counts[1]);
      expect(counts[2]).toBeGreaterThan(counts[3]);
    });
  });

  describe('Tier 2: seeded pick for new movie', () => {
    it('selects second from established movies when first is new', () => {
      // First pick is new (< K=5 comparisons), enough established movies exist (>= K=5)
      randomSpy.mockReturnValue(0.01); // small value to pick first movie (new one, high weight)
      const movies = [
        makeCandidate({ id: 1, userComparisonCount: 0, elo_rating: 1000 }),
        makeCandidate({ id: 2, userComparisonCount: 10, elo_rating: 1050 }),
        makeCandidate({ id: 3, userComparisonCount: 10, elo_rating: 1020 }),
        makeCandidate({ id: 4, userComparisonCount: 10, elo_rating: 980 }),
        makeCandidate({ id: 5, userComparisonCount: 10, elo_rating: 950 }),
        makeCandidate({ id: 6, userComparisonCount: 10, elo_rating: 900 }),
      ];
      const [first, second] = selectPair(movies);
      expect(first.userComparisonCount).toBeLessThan(5);
      expect(second.userComparisonCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Tier 3: Elo-proximity for established first pick', () => {
    it('selects second from closest Elo-rated movies', () => {
      // All movies are established (>= K=5 comparisons)
      randomSpy.mockReturnValue(0.01);
      const movies = [
        makeCandidate({ id: 1, userComparisonCount: 10, elo_rating: 1000 }),
        makeCandidate({ id: 2, userComparisonCount: 10, elo_rating: 1001 }),
        makeCandidate({ id: 3, userComparisonCount: 10, elo_rating: 1500 }),
        makeCandidate({ id: 4, userComparisonCount: 10, elo_rating: 500 }),
        makeCandidate({ id: 5, userComparisonCount: 10, elo_rating: 999 }),
        makeCandidate({ id: 6, userComparisonCount: 10, elo_rating: 998 }),
      ];
      const [first, second] = selectPair(movies);
      // Second should be from the closest Elo pool to first
      const eloDiff = Math.abs(first.elo_rating - second.elo_rating);
      expect(eloDiff).toBeLessThan(500); // should be close, not picking the extremes
    });
  });

  describe('Fallback: IFW from remaining when not enough established', () => {
    it('uses IFW when first is new but too few established movies', () => {
      randomSpy.mockReturnValue(0.01);
      const movies = [
        makeCandidate({ id: 1, userComparisonCount: 0 }),
        makeCandidate({ id: 2, userComparisonCount: 1 }),
        makeCandidate({ id: 3, userComparisonCount: 2 }),
      ];
      // Not enough established (K=5), so fallback to IFW
      const [first, second] = selectPair(movies);
      expect(first.id).not.toBe(second.id);
    });
  });

  describe('statistical properties', () => {
    it('never returns the same movie twice', () => {
      const movies = Array.from({ length: 20 }, (_, i) =>
        makeCandidate({
          id: i + 1,
          userComparisonCount: i,
          elo_rating: 1000 + i * 10,
        }),
      );
      // Run 50 iterations with real Math.random
      randomSpy.mockRestore();
      for (let i = 0; i < 50; i++) {
        const [first, second] = selectPair(movies);
        expect(first.id).not.toBe(second.id);
      }
    });

    it('always returns exactly 2 movies', () => {
      randomSpy.mockRestore();
      const movies = Array.from({ length: 10 }, (_, i) =>
        makeCandidate({ id: i + 1, userComparisonCount: i }),
      );
      const result = selectPair(movies);
      expect(result).toHaveLength(2);
    });
  });
});
