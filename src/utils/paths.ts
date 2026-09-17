import { ContentKind, ViewName } from '../models/Content';

// URL-driven navigation (D-6). The app has no router; kind + view live in the
// path so links are shareable and survive a refresh. Movies use the `movies`
// segment, shows use `shows`; the second segment is the view.

export interface Route {
  kind: ContentKind;
  view: ViewName;
}

const KIND_STORAGE_KEY = 'contentKind';

const SEGMENT_TO_KIND: Record<string, ContentKind> = {
  movies: 'movie',
  shows: 'show',
};

// URL view segment → ViewName. Queue is the empty second segment.
const SEGMENT_TO_VIEW: Record<string, ViewName> = {
  'this-or-that': 'this-or-that',
  combined: 'combined-list',
  history: 'history',
};

const VIEW_TO_SEGMENT: Partial<Record<ViewName, string>> = {
  'this-or-that': 'this-or-that',
  'combined-list': 'combined',
  history: 'history',
};

function isKind(value: unknown): value is ContentKind {
  return value === 'movie' || value === 'show';
}

/** Last-used kind, persisted so `/` lands where the user left off. */
export function readStoredKind(): ContentKind {
  try {
    const stored = localStorage.getItem(KIND_STORAGE_KEY);
    return isKind(stored) ? stored : 'movie';
  } catch {
    return 'movie';
  }
}

export function storeKind(kind: ContentKind): void {
  try {
    localStorage.setItem(KIND_STORAGE_KEY, kind);
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
}

/**
 * Canonical path for a (kind, view). `admin` is kind-agnostic → `/admin`.
 */
export function viewToPath(kind: ContentKind, view: ViewName): string {
  if (view === 'admin') return '/admin';
  const kindSegment = kind === 'show' ? 'shows' : 'movies';
  const viewSegment = VIEW_TO_SEGMENT[view];
  return viewSegment ? `/${kindSegment}/${viewSegment}` : `/${kindSegment}`;
}

/**
 * Parse a pathname into a (kind, view). Unknown paths and `/` fall back to the
 * last-used kind (or movies) on the queue view; the caller is expected to
 * replaceState to the canonical path so the URL is honest after a redirect.
 */
export function parsePath(pathname: string): Route {
  const segments = pathname.split('/').filter(Boolean);
  const [first, second] = segments;

  if (first === 'admin') {
    return { kind: readStoredKind(), view: 'admin' };
  }

  const kind = SEGMENT_TO_KIND[first];
  if (kind) {
    const view = second ? (SEGMENT_TO_VIEW[second] ?? 'queue') : 'queue';
    return { kind, view };
  }

  // `/` or anything unrecognised → last-used kind, queue.
  return { kind: readStoredKind(), view: 'queue' };
}
