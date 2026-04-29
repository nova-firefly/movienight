import fs from 'fs';
import path from 'path';
import pool from './db';
import { createList, syncList } from './mdblist';

export interface ExportListResult {
  name: string;
  type: 'combined' | 'solo';
  movieCount: number;
  mdblistUrl: string | null;
}

export interface ExportResult {
  filePath: string;
  lists: ExportListResult[];
}

interface ConnectionPair {
  connectionId: number;
  userAId: number;
  userAName: string;
  userBId: number;
  userBName: string;
}

interface UserWithConnections {
  id: number;
  name: string;
}

function displayName(row: { display_name: string | null; username: string }): string {
  return row.display_name || row.username;
}

/** Get all accepted connections with user display names, sorted alphabetically by pair name. */
async function getAcceptedConnections(): Promise<ConnectionPair[]> {
  const result = await pool.query(
    `SELECT uc.id AS connection_id,
            u1.id AS u1_id, u1.display_name AS u1_display, u1.username AS u1_username,
            u2.id AS u2_id, u2.display_name AS u2_display, u2.username AS u2_username
     FROM user_connections uc
     JOIN users u1 ON u1.id = uc.requester_id
     JOIN users u2 ON u2.id = uc.addressee_id
     WHERE uc.status = 'accepted'
     ORDER BY uc.id`,
  );

  return result.rows.map((r: any) => {
    const nameA = displayName({ display_name: r.u1_display, username: r.u1_username });
    const nameB = displayName({ display_name: r.u2_display, username: r.u2_username });
    // Sort alphabetically for consistent naming
    if (nameA.localeCompare(nameB) <= 0) {
      return {
        connectionId: r.connection_id,
        userAId: r.u1_id,
        userAName: nameA,
        userBId: r.u2_id,
        userBName: nameB,
      };
    }
    return {
      connectionId: r.connection_id,
      userAId: r.u2_id,
      userAName: nameB,
      userBId: r.u1_id,
      userBName: nameA,
    };
  });
}

/** Get all distinct users who have at least one accepted connection. */
async function getUsersWithConnections(): Promise<UserWithConnections[]> {
  const result = await pool.query(
    `SELECT DISTINCT u.id, u.display_name, u.username
     FROM users u
     WHERE EXISTS (
       SELECT 1 FROM user_connections uc
       WHERE uc.status = 'accepted'
         AND (uc.requester_id = u.id OR uc.addressee_id = u.id)
     )
     ORDER BY u.id`,
  );
  return result.rows.map((r: any) => ({
    id: r.id,
    name: displayName(r),
  }));
}

/**
 * Get combined list TMDB IDs for a pair of users.
 * Symmetric: excludes movies either user has passed on.
 */
async function getCombinedTmdbIds(userAId: number, userBId: number): Promise<number[]> {
  const result = await pool.query(
    `SELECT m.tmdb_id,
            CASE
              WHEN ume_a.elo_rating IS NOT NULL AND ume_b.elo_rating IS NOT NULL
              THEN (ume_a.elo_rating + ume_b.elo_rating) / 2
              ELSE COALESCE(ume_a.elo_rating, ume_b.elo_rating)
            END AS combined_elo,
            (ume_a.elo_rating IS NOT NULL AND ume_b.elo_rating IS NOT NULL) AS both_rated
     FROM movies m
     LEFT JOIN user_movie_elo ume_a ON ume_a.movie_id = m.id AND ume_a.user_id = $1
     LEFT JOIN user_movie_elo ume_b ON ume_b.movie_id = m.id AND ume_b.user_id = $2
     LEFT JOIN movie_interest mi_a ON mi_a.movie_id = m.id AND mi_a.user_id = $1
     LEFT JOIN movie_interest mi_b ON mi_b.movie_id = m.id AND mi_b.user_id = $2
     WHERE m.watched_at IS NULL
       AND m.tmdb_id IS NOT NULL AND m.tmdb_id > 0
       AND (ume_a.elo_rating IS NOT NULL OR ume_b.elo_rating IS NOT NULL)
       AND (mi_a.interested IS NULL OR mi_a.interested = true)
       AND (mi_b.interested IS NULL OR mi_b.interested = true)
     ORDER BY both_rated DESC, combined_elo DESC`,
    [userAId, userBId],
  );
  return result.rows.map((r: any) => r.tmdb_id);
}

/**
 * Get solo list TMDB IDs for a user.
 * Movies the user added where ALL their connections passed.
 */
async function getSoloTmdbIds(userId: number): Promise<number[]> {
  const result = await pool.query(
    `WITH my_connections AS (
       SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS other_id
       FROM user_connections
       WHERE status = 'accepted'
         AND (requester_id = $1 OR addressee_id = $1)
     )
     SELECT m.tmdb_id
     FROM movies m
     WHERE m.requested_by = $1
       AND m.watched_at IS NULL
       AND m.tmdb_id IS NOT NULL AND m.tmdb_id > 0
       AND (SELECT COUNT(*) FROM my_connections) > 0
       AND NOT EXISTS (
         SELECT 1 FROM my_connections mc
         WHERE NOT EXISTS (
           SELECT 1 FROM movie_interest mi
           WHERE mi.movie_id = m.id AND mi.user_id = mc.other_id AND mi.interested = false
         )
       )
     ORDER BY m.date_submitted DESC`,
    [userId],
  );
  return result.rows.map((r: any) => r.tmdb_id);
}

/** Get or create an MDBList list for a given type/ref, persisting in kometa_mdblist_lists. */
async function getOrCreateMdbList(
  apiKey: string,
  listType: string,
  refId: number,
  name: string,
): Promise<{ listId: number; listUrl: string }> {
  const existing = await pool.query(
    'SELECT mdblist_list_id, mdblist_list_url FROM kometa_mdblist_lists WHERE list_type = $1 AND ref_id = $2',
    [listType, refId],
  );

  if (existing.rows.length > 0 && existing.rows[0].mdblist_list_id) {
    return {
      listId: existing.rows[0].mdblist_list_id,
      listUrl: existing.rows[0].mdblist_list_url,
    };
  }

  const listInfo = await createList(apiKey, name);

  await pool.query(
    `INSERT INTO kometa_mdblist_lists (list_type, ref_id, list_name, mdblist_list_id, mdblist_list_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (list_type, ref_id) DO UPDATE
       SET mdblist_list_id = $4, mdblist_list_url = $5, list_name = $3, updated_at = NOW()`,
    [listType, refId, name, listInfo.id, listInfo.url],
  );

  return { listId: listInfo.id, listUrl: listInfo.url };
}

/** Generate Kometa YAML with multiple collections. */
export function generateMultiCollectionYaml(lists: ExportListResult[]): string {
  const today = new Date().toISOString().split('T')[0];
  let yaml = `## MovieNight Collections — auto-exported ${today}\n`;
  yaml += `## Generated by MovieNight. Do not edit manually.\n`;
  yaml += `collections:\n`;
  for (const list of lists) {
    yaml += `  "${list.name}":\n`;
    yaml += `    mdblist_list: ${list.mdblistUrl}\n`;
    yaml += `    collection_order: custom\n`;
    yaml += `    sync_mode: sync\n`;
    yaml += `    radarr_add_missing: true\n`;
    yaml += `    radarr_search: true\n`;
    yaml += `    visible_home: true\n`;
    yaml += `    visible_shared: true\n`;
    yaml += `    summary: "MovieNight — ${list.name} — exported ${today}"\n`;
  }
  return yaml;
}

/**
 * Main export function: builds combined + solo lists, syncs to MDBList, writes YAML.
 * Used by both the resolver and the scheduler.
 */
export async function runKometaExport(
  collectionsPath: string,
  mdblistApiKey: string,
): Promise<ExportResult> {
  const lists: ExportListResult[] = [];

  // 1. Combined lists — one per accepted connection
  const connections = await getAcceptedConnections();
  for (const conn of connections) {
    const tmdbIds = await getCombinedTmdbIds(conn.userAId, conn.userBId);
    if (tmdbIds.length === 0) continue;
    const name = `${conn.userAName} & ${conn.userBName}`;
    const { listId, listUrl } = await getOrCreateMdbList(
      mdblistApiKey,
      'combined',
      conn.connectionId,
      name,
    );
    await syncList(mdblistApiKey, listId, tmdbIds);
    lists.push({ name, type: 'combined', movieCount: tmdbIds.length, mdblistUrl: listUrl });
  }

  // 2. Solo lists — one per user who has connections
  const users = await getUsersWithConnections();
  for (const user of users) {
    const tmdbIds = await getSoloTmdbIds(user.id);
    if (tmdbIds.length === 0) continue;
    const name = `Just ${user.name}`;
    const { listId, listUrl } = await getOrCreateMdbList(mdblistApiKey, 'solo', user.id, name);
    await syncList(mdblistApiKey, listId, tmdbIds);
    lists.push({ name, type: 'solo', movieCount: tmdbIds.length, mdblistUrl: listUrl });
  }

  // 3. Write YAML
  const yaml = generateMultiCollectionYaml(lists);
  const filePath = path.join(collectionsPath, 'movienight.yml');
  await fs.promises.writeFile(filePath, yaml, 'utf8');

  return { filePath, lists };
}
