/**
 * Shared cross-kind helpers for content (movies + shows).
 *
 * Purpose: extract the small handful of resolver helpers that are — or
 * will be — reused by both movie and show resolvers, so drift between
 * the two parallel resolver stacks is minimised. Every helper here must
 * be kind-agnostic or kind-parameterised.
 *
 * Kept intentionally small in Phase 1 — this file grows in Phase 2 as
 * shows resolvers land (`updateWatchedState`, `unwatchItem`, etc.).
 */
import pool from './db';
import { GraphQLError } from 'graphql';
import { runKometaExport } from './kometaExport';

export type Kind = 'movie' | 'show';

export const CONTENT_TABLE: Record<Kind, string> = {
  movie: 'movies',
  show: 'shows',
};

export const AUDIT_TARGET_TYPE: Record<Kind, string> = {
  movie: 'movie',
  show: 'show',
};

// Per-kind table/column names for the interest and tag stacks. Interpolated
// into SQL below; sourced only from these closed maps keyed by the Kind union,
// never from user input. Every value stays parameterised ($1, $2, …).
const INTEREST_TABLE: Record<Kind, string> = {
  movie: 'movie_interest',
  show: 'show_interest',
};
const TAG_TABLE: Record<Kind, string> = {
  movie: 'movie_user_tags',
  show: 'show_user_tags',
};
const CONTENT_ID_COLUMN: Record<Kind, string> = {
  movie: 'movie_id',
  show: 'show_id',
};

interface AuthContext {
  user?: { userId: number; isAdmin: boolean } | null;
}

/**
 * Owner-or-admin gate. Throws FORBIDDEN unless the caller is an admin or the
 * owner of the row. Assumes the caller has already checked `context.user`.
 */
export function assertOwnerOrAdmin(context: AuthContext, ownerId: number | null): void {
  if (!context.user?.isAdmin && ownerId !== context.user?.userId) {
    throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
  }
}

/**
 * Owner-or-admin-or-accepted-connection gate. Mirrors `markWatched`'s wider
 * gate: an accepted connection of the owner may act too. Throws FORBIDDEN
 * otherwise. Assumes the caller has already checked `context.user`.
 */
export async function assertOwnerAdminOrConnection(
  context: AuthContext,
  ownerId: number | null,
): Promise<void> {
  if (context.user?.isAdmin || ownerId === context.user?.userId) return;
  const conn = await pool.query(
    `SELECT 1 FROM user_connections
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND addressee_id = $2)
              OR (addressee_id = $1 AND requester_id = $2))
       LIMIT 1`,
    [context.user?.userId, ownerId],
  );
  if (conn.rows.length === 0) {
    throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
  }
}

/**
 * Flip a content row's watched state. Setting watched stamps `watched_at`;
 * clearing it nulls `watched_at`. Movies additionally re-rank to the queue end
 * on unwatch (the legacy `rank` column); shows have no `rank`, so that step is
 * skipped for `kind === 'show'`. Returns the updated row.
 */
export async function updateWatchedState(
  kind: Kind,
  id: string | number,
  watched: boolean,
): Promise<any> {
  const table = CONTENT_TABLE[kind];
  if (watched) {
    const res = await pool.query(
      `UPDATE ${table} SET watched_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    return res.rows[0];
  }
  if (kind === 'movie') {
    const res = await pool.query(
      `UPDATE movies
       SET watched_at = NULL,
           rank = (SELECT COALESCE(MAX(rank), 0) + 1 FROM movies WHERE watched_at IS NULL)
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    return res.rows[0];
  }
  const res = await pool.query(`UPDATE ${table} SET watched_at = NULL WHERE id = $1 RETURNING *`, [
    id,
  ]);
  return res.rows[0];
}

/**
 * Upsert a per-user interest (pass/skip) flag on a content row.
 */
export async function setInterest(
  kind: Kind,
  userId: number,
  contentId: string | number,
  interested: boolean,
): Promise<void> {
  const table = INTEREST_TABLE[kind];
  const idCol = CONTENT_ID_COLUMN[kind];
  await pool.query(
    `INSERT INTO ${table} (user_id, ${idCol}, interested, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, ${idCol})
     DO UPDATE SET interested = $3, updated_at = NOW()`,
    [userId, contentId, interested],
  );
}

/**
 * Upsert a per-user tag instance on a content row. Returns the tag row.
 */
export async function upsertTag(
  kind: Kind,
  contentId: string | number,
  userId: number,
  tagId: number,
  value: string | null,
): Promise<any> {
  const table = TAG_TABLE[kind];
  const idCol = CONTENT_ID_COLUMN[kind];
  const res = await pool.query(
    `INSERT INTO ${table} (${idCol}, user_id, tag_id, value, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (${idCol}, user_id, tag_id)
     DO UPDATE SET value = $4, updated_at = NOW()
     RETURNING *`,
    [contentId, userId, tagId, value],
  );
  return res.rows[0];
}

/**
 * Delete a per-user tag instance. Returns the deleted rows (empty if none).
 */
export async function removeTag(
  kind: Kind,
  contentId: string | number,
  userId: number,
  tagId: number,
): Promise<any[]> {
  const table = TAG_TABLE[kind];
  const idCol = CONTENT_ID_COLUMN[kind];
  const res = await pool.query(
    `DELETE FROM ${table} WHERE ${idCol} = $1 AND user_id = $2 AND tag_id = $3 RETURNING id`,
    [contentId, userId, tagId],
  );
  return res.rows;
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/**
 * Best-effort audit log write. Errors are logged, never thrown, so
 * audit failures never take down a user-visible mutation.
 */
export async function logAudit(
  actorId: number | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: object | null,
  ipAddress: string,
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [actorId, action, targetType, targetId, metadata, ipAddress],
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

/**
 * Re-sync MDBList lists after a content watched-state change so that
 * MDBList (and the Kometa-pulled Plex collection) drops watched items
 * and re-adds them on unwatch. Best-effort: errors logged, never thrown.
 *
 * `contextMetadata` is merged into the audit-log payload so callers can
 * attach whatever identifiers are meaningful (movieId, showId, tmdb_id).
 */
export async function triggerMdblistSyncInBackground(
  actorId: number,
  ipAddress: string,
  trigger: string,
  contextMetadata: Record<string, unknown>,
): Promise<void> {
  try {
    const schedRow = await pool.query('SELECT mdblist_api_key FROM kometa_schedule WHERE id = 1');
    const mdblistApiKey = schedRow.rows[0]?.mdblist_api_key || process.env.MDBLIST_API_KEY;
    if (!mdblistApiKey) return;

    const prod = isProduction();
    const { lists } = await runKometaExport({
      collectionsPath: null,
      mdblistApiKey,
      namePrefix: prod ? '' : '[DEV] ',
      environment: prod ? 'production' : 'development',
    });

    await logAudit(
      actorId,
      'MDBLIST_AUTO_SYNC',
      'mdblist',
      null,
      {
        trigger,
        ...contextMetadata,
        listCount: lists.length,
        totalMovies: lists.reduce((sum, l) => sum + l.movieCount, 0),
      },
      ipAddress,
    );
  } catch (err) {
    console.error('[MDBList auto-sync] Failed:', err);
  }
}
