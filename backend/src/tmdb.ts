/**
 * TMDB API adapter.
 *
 * Handles search + metadata fetch/persist for both movies and shows.
 * Kind-dispatch keeps the HTTP layer in one place so future TMDB v4
 * migration or rate-limiting lives in a single file.
 *
 * The persist side (fetchAndStoreTmdbData) writes to `movies` or `shows`
 * depending on kind; both branches are used by the shows resolver in
 * Phase 2. Only the movie branch has live callers today.
 */
import pool from './db';

export type Kind = 'movie' | 'show';

export interface TmdbSearchResult {
  tmdb_id: number;
  title: string;
  release_year: string | null; // shows populate this from first_air_date
  overview: string | null;
}

interface TmdbSharedMetadata {
  title: string;
  poster_path: string | null;
  cast_list: string[];
  genre_tags: string[];
}

export interface TmdbMovieMetadata extends TmdbSharedMetadata {
  kind: 'movie';
  release_year: string | null;
  director: string | null;
}

export interface TmdbShowMetadata extends TmdbSharedMetadata {
  kind: 'show';
  first_air_year: string | null;
  created_by: string[];
  networks: string[];
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  status: string | null;
}

export type TmdbMetadata = TmdbMovieMetadata | TmdbShowMetadata;

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_ENDPOINT: Record<Kind, string> = { movie: 'movie', show: 'tv' };

function apiKey(): string | null {
  return process.env.TMDB_API_KEY || null;
}

export function isTmdbConfigured(): boolean {
  return Boolean(apiKey());
}

// TMDB ids are positive integers; rejecting anything else keeps callers from
// steering requests to other TMDB endpoints via the URL path.
function isValidTmdbId(tmdbId: unknown): tmdbId is number {
  return typeof tmdbId === 'number' && Number.isSafeInteger(tmdbId) && tmdbId > 0;
}

function extractYear(date: string | null | undefined): string | null {
  if (!date) return null;
  return date.split('-')[0] || null;
}

export async function searchTmdb(kind: Kind, query: string): Promise<TmdbSearchResult[]> {
  const key = apiKey();
  if (!key) throw new Error('TMDB_API_KEY not configured');

  const endpoint = TMDB_ENDPOINT[kind];
  const url = `${TMDB_BASE}/search/${endpoint}?api_key=${key}&query=${encodeURIComponent(
    query,
  )}&language=en-US&page=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB search failed (${response.status})`);
  const data = (await response.json()) as { results?: unknown[] };
  const results = Array.isArray(data.results) ? data.results : [];

  return results.slice(0, 10).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      tmdb_id: r.id as number,
      title: (kind === 'movie' ? (r.title as string) : (r.name as string)) ?? '',
      release_year: extractYear(
        (kind === 'movie' ? (r.release_date as string) : (r.first_air_date as string)) ?? null,
      ),
      overview: (r.overview as string) || null,
    };
  });
}

export async function fetchTmdbMetadata(kind: Kind, tmdbId: number): Promise<TmdbMetadata | null> {
  const key = apiKey();
  if (!key) return null;
  if (!isValidTmdbId(tmdbId)) return null;

  const endpoint = TMDB_ENDPOINT[kind];
  try {
    const [detailRes, creditsRes, keywordsRes] = await Promise.all([
      fetch(`${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${key}&language=en-US`),
      fetch(`${TMDB_BASE}/${endpoint}/${tmdbId}/credits?api_key=${key}&language=en-US`),
      fetch(`${TMDB_BASE}/${endpoint}/${tmdbId}/keywords?api_key=${key}`),
    ]);

    const detail = detailRes.ok ? ((await detailRes.json()) as Record<string, any>) : null;
    const credits = creditsRes.ok ? ((await creditsRes.json()) as Record<string, any>) : null;
    const keywords = keywordsRes.ok ? ((await keywordsRes.json()) as Record<string, any>) : null;

    if (!detail) return null;

    const genres: string[] = (detail.genres ?? []).map((g: { name: string }) => g.name);
    // TMDB keywords use `.keywords` for movies, `.results` for TV
    const keywordSource: Array<{ name: string }> = keywords?.keywords ?? keywords?.results ?? [];
    const keywordNames: string[] = keywordSource.map((k) => k.name);
    const genre_tags = [...genres, ...keywordNames.filter((k) => !genres.includes(k))].slice(0, 5);

    const poster_path: string | null = detail.poster_path ?? null;
    const cast_list: string[] = ((credits?.cast ?? []) as Array<{ name: string }>)
      .slice(0, 3)
      .map((c) => c.name);

    if (kind === 'movie') {
      const director =
        ((credits?.crew ?? []) as Array<{ job: string; name: string }>).find(
          (c) => c.job === 'Director',
        )?.name ?? null;
      return {
        kind: 'movie',
        title: detail.title,
        poster_path,
        release_year: extractYear(detail.release_date),
        director,
        cast_list,
        genre_tags,
      };
    }

    return {
      kind: 'show',
      title: detail.name,
      poster_path,
      first_air_year: extractYear(detail.first_air_date),
      created_by: ((detail.created_by ?? []) as Array<{ name: string }>).map((c) => c.name),
      networks: ((detail.networks ?? []) as Array<{ name: string }>).map((n) => n.name),
      number_of_seasons: detail.number_of_seasons ?? null,
      number_of_episodes: detail.number_of_episodes ?? null,
      status: detail.status ?? null,
      cast_list,
      genre_tags,
    };
  } catch (err) {
    console.error('TMDB fetch failed for %s %d:', kind, tmdbId, err);
    return null;
  }
}

/**
 * Fetch TMDB metadata and persist to the matching table. Best-effort —
 * errors are logged, never thrown. Silently no-op if TMDB_API_KEY is unset.
 */
export async function fetchAndStoreTmdbData(
  kind: Kind,
  contentId: number,
  tmdbId: number,
): Promise<void> {
  const metadata = await fetchTmdbMetadata(kind, tmdbId);
  if (!metadata) return;

  try {
    if (metadata.kind === 'movie') {
      await pool.query(
        `UPDATE movies
         SET poster_path = $1, release_year = $2, director = $3,
             cast_list = $4, genre_tags = $5, tmdb_fetched_at = NOW()
         WHERE id = $6`,
        [
          metadata.poster_path,
          metadata.release_year,
          metadata.director,
          metadata.cast_list,
          metadata.genre_tags,
          contentId,
        ],
      );
    } else {
      await pool.query(
        `UPDATE shows
         SET poster_path = $1, first_air_year = $2, created_by = $3, networks = $4,
             cast_list = $5, genre_tags = $6, number_of_seasons = $7,
             number_of_episodes = $8, status = $9, tmdb_fetched_at = NOW()
         WHERE id = $10`,
        [
          metadata.poster_path,
          metadata.first_air_year,
          metadata.created_by,
          metadata.networks,
          metadata.cast_list,
          metadata.genre_tags,
          metadata.number_of_seasons,
          metadata.number_of_episodes,
          metadata.status,
          contentId,
        ],
      );
    }
  } catch (err) {
    console.error('TMDB persist failed for %s %d (tmdb %d):', kind, contentId, tmdbId, err);
  }
}
