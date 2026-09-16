import { ContentKind } from '../models/Content';

// TMDB uses /movie/<id> for films and /tv/<id> for shows. One helper so the
// kind→path mapping lives in a single place (was hardcoded /movie/ in five
// spots before Phase 4).
export function tmdbUrl(kind: ContentKind, tmdbId: number | string): string {
  const segment = kind === 'show' ? 'tv' : 'movie';
  return `https://www.themoviedb.org/${segment}/${tmdbId}`;
}
