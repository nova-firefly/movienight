const K = 5; // established threshold
const EP_POOL_MIN = 5; // minimum EP candidate pool size
const SEED_ELO_BAND = 150; // +/- Elo around median for seeded "peer" pick

export interface ContentCandidate {
  id: number;
  title: string;
  tmdb_id: number | null;
  userComparisonCount: number;
  elo_rating: number;
}

export function selectPair(candidates: ContentCandidate[]): [ContentCandidate, ContentCandidate] {
  if (candidates.length < 2) throw new Error('Not enough items');

  const epPoolSize = Math.max(EP_POOL_MIN, Math.floor(candidates.length * 0.1));

  // Tier 1: IFW first pick
  const weights = candidates.map((m) => 1 / (m.userComparisonCount + 1));
  const first = weightedRandomPick(candidates, weights);

  const rest = candidates.filter((m) => m.id !== first.id);
  const established = rest.filter((m) => m.userComparisonCount >= K);

  let second: ContentCandidate;

  if (first.userComparisonCount < K && established.length >= K) {
    // Tier 2: seeded pick
    const median = medianElo(established);
    const peers = established.filter((m) => Math.abs(m.elo_rating - median) <= SEED_ELO_BAND);
    const peerPool = peers.length > 0 ? peers : established;
    const rangerPool = established;
    second = Math.random() < 0.5 ? randomPick(peerPool) : randomPick(rangerPool);
  } else if (first.userComparisonCount >= K && established.length > 0) {
    // Tier 3: Elo-proximity pick
    const sorted = [...rest].sort(
      (a, b) =>
        Math.abs(a.elo_rating - first.elo_rating) - Math.abs(b.elo_rating - first.elo_rating),
    );
    second = randomPick(sorted.slice(0, epPoolSize));
  } else {
    // Fallback: IFW from remaining
    const restWeights = rest.map((m) => 1 / (m.userComparisonCount + 1));
    second = weightedRandomPick(rest, restWeights);
  }

  return [first, second];
}

function weightedRandomPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function medianElo(candidates: ContentCandidate[]): number {
  const sorted = [...candidates].map((m) => m.elo_rating).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
