// MDBList API client for managing static lists
// Docs: https://docs.mdblist.com/docs/api

const BASE_URL = 'https://api.mdblist.com';

export interface MdbListInfo {
  id: number;
  slug: string;
  url: string;
}

interface MdbListItem {
  tmdb?: number;
  imdb?: string;
}

interface MdbListItemsResponse {
  movies: MdbListItem[];
  shows: MdbListItem[];
}

/** Create a new static list on MDBList. */
export async function createList(apiKey: string, name: string): Promise<MdbListInfo> {
  const res = await fetch(`${BASE_URL}/lists/user/add?apikey=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, private: false }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MDBList create list failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: number; slug: string; url: string };
  return { id: data.id, slug: data.slug, url: data.url };
}

/** Get current items in a list. */
async function getListItems(apiKey: string, listId: number): Promise<number[]> {
  const res = await fetch(
    `${BASE_URL}/lists/${listId}/items?apikey=${encodeURIComponent(apiKey)}&limit=1000`,
    { signal: AbortSignal.timeout(15000) },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MDBList get items failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as MdbListItemsResponse;
  return (data.movies || []).filter((m) => m.tmdb).map((m) => m.tmdb!);
}

/** Remove items from a list by TMDB IDs. */
async function removeItems(apiKey: string, listId: number, tmdbIds: number[]): Promise<void> {
  if (tmdbIds.length === 0) return;

  const res = await fetch(
    `${BASE_URL}/lists/${listId}/items/remove?apikey=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movies: tmdbIds.map((id) => ({ tmdb: id })) }),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MDBList remove items failed (${res.status}): ${text}`);
  }
}

/** Add items to a list by TMDB IDs (order is preserved). */
async function addItems(apiKey: string, listId: number, tmdbIds: number[]): Promise<void> {
  if (tmdbIds.length === 0) return;

  const res = await fetch(
    `${BASE_URL}/lists/${listId}/items/add?apikey=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movies: tmdbIds.map((id) => ({ tmdb: id })) }),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MDBList add items failed (${res.status}): ${text}`);
  }
}

/**
 * Sync a list to contain exactly the given TMDB IDs in order.
 * Clears existing items, then adds the new set in rank order.
 */
export async function syncList(apiKey: string, listId: number, tmdbIds: number[]): Promise<void> {
  // Get current items and remove them all
  const existing = await getListItems(apiKey, listId);
  await removeItems(apiKey, listId, existing);

  // Add new items in order
  await addItems(apiKey, listId, tmdbIds);
}
