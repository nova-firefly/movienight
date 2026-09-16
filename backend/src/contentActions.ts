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
