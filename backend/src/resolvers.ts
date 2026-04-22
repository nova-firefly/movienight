import fs from 'fs';
import path from 'path';
import pool from './db';
import { hashPassword, comparePassword, generateToken } from './auth';
import { User, CreateUserInput, UpdateUserInput } from './models/User';
import { GraphQLError } from 'graphql';
import { rescheduleKometa, scheduleBordaRecalculation } from './scheduler';

const USER_COLS =
  'id, username, email, display_name, is_admin, is_active, last_login_at, created_at, updated_at';

async function logAudit(
  actorId: number | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: object | null,
  ipAddress: string
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [actorId, action, targetType, targetId, metadata, ipAddress]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

async function logLoginHistory(
  userId: number | null,
  ipAddress: string,
  userAgent: string,
  succeeded: boolean
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent, succeeded) VALUES ($1, $2, $3, $4)',
      [userId, ipAddress, userAgent, succeeded]
    );
  } catch (err) {
    console.error('Failed to write login history:', err);
  }
}

const isProduction = () => process.env.NODE_ENV === 'production';

export const resolvers = {
  Query: {
    appInfo: () => ({
      isProduction: isProduction(),
      quickLoginUsers: isProduction() ? [] : [
        {
          label: 'Admin',
          username: 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123',
        },
        {
          label: 'Test User',
          username: process.env.TEST_USER_USERNAME || 'testuser',
          password: process.env.TEST_USER_PASSWORD || 'testpass',
        },
      ],
    }),
    searchTmdb: async (_: any, { query }: { query: string }) => {
      const apiKey = process.env.TMDB_API_KEY;
      if (!apiKey) {
        throw new GraphQLError('TMDB API key not configured', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new GraphQLError('TMDB search failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
      const data = await response.json() as any;
      return (data.results as any[]).slice(0, 10).map((movie: any) => ({
        tmdb_id: movie.id,
        title: movie.title,
        release_year: movie.release_date ? movie.release_date.split('-')[0] : null,
        overview: movie.overview || null,
      }));
    },
    movies: async (_: any, __: any, context: any) => {
      if (context.user) {
        // Authenticated: order by this user's personal ranking (unranked movies at bottom)
        const result = await pool.query(
          `SELECT m.id, m.title, m.requested_by, m.date_submitted, m.rank, m.tmdb_id, m.watched_at,
                  u.username AS user_username, u.display_name AS user_display_name
           FROM movies m
           LEFT JOIN users u ON m.requested_by = u.id
           LEFT JOIN user_movie_rankings umr ON umr.movie_id = m.id AND umr.user_id = $1
           WHERE m.watched_at IS NULL
           ORDER BY umr.rank ASC NULLS LAST, m.date_submitted ASC`,
          [context.user.userId]
        );
        return result.rows;
      }
      // Unauthenticated: order by cached Borda score (higher = more wanted by users)
      const result = await pool.query(
        `SELECT m.id, m.title, m.requested_by, m.date_submitted, m.rank, m.tmdb_id, m.watched_at,
                u.username AS user_username, u.display_name AS user_display_name
         FROM movies m
         LEFT JOIN users u ON m.requested_by = u.id
         WHERE m.watched_at IS NULL
         ORDER BY m.rank DESC NULLS LAST, m.date_submitted ASC`
      );
      return result.rows;
    },
    movie: async (_: any, { id }: { id: string }) => {
      const result = await pool.query(
        `SELECT m.id, m.title, m.requested_by, m.date_submitted, m.rank, m.tmdb_id, m.watched_at,
                u.username AS user_username, u.display_name AS user_display_name
         FROM movies m
         LEFT JOIN users u ON m.requested_by = u.id
         WHERE m.id = $1`,
        [id]
      );
      return result.rows[0];
    },
    me: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      const result = await pool.query(
        `SELECT ${USER_COLS} FROM users WHERE id = $1`,
        [context.user.userId]
      );
      return result.rows[0];
    },
    users: async (_: any, __: any, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query(
        `SELECT ${USER_COLS} FROM users ORDER BY created_at DESC`
      );
      return result.rows;
    },
    user: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query(
        `SELECT ${USER_COLS} FROM users WHERE id = $1`,
        [id]
      );
      return result.rows[0];
    },
    auditLogs: async (
      _: any,
      { limit = 100, offset = 0 }: { limit?: number; offset?: number },
      context: any
    ) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query(
        `SELECT al.id, al.actor_id, u.username AS actor_username, al.action,
                al.target_type, al.target_id, al.metadata, al.ip_address, al.created_at
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         ORDER BY al.created_at DESC
         LIMIT $1 OFFSET $2`,
        [Math.min(limit, 500), offset]
      );
      return result.rows;
    },
    loginHistory: async (
      _: any,
      { userId, limit = 100 }: { userId?: string; limit?: number },
      context: any
    ) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const cap = Math.min(limit, 500);
      if (userId) {
        const result = await pool.query(
          `SELECT lh.id, lh.user_id, u.username, lh.ip_address, lh.user_agent,
                  lh.succeeded, lh.created_at
           FROM login_history lh
           LEFT JOIN users u ON lh.user_id = u.id
           WHERE lh.user_id = $1
           ORDER BY lh.created_at DESC
           LIMIT $2`,
          [userId, cap]
        );
        return result.rows;
      }
      const result = await pool.query(
        `SELECT lh.id, lh.user_id, u.username, lh.ip_address, lh.user_agent,
                lh.succeeded, lh.created_at
         FROM login_history lh
         LEFT JOIN users u ON lh.user_id = u.id
         ORDER BY lh.created_at DESC
         LIMIT $1`,
        [cap]
      );
      return result.rows;
    },
    combinedRankings: async (_: any, { userIds }: { userIds: string[] }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const moviesResult = await pool.query(
        `SELECT m.id, m.title, m.requested_by, m.date_submitted, m.rank, m.tmdb_id, m.watched_at,
                u.username AS user_username, u.display_name AS user_display_name
         FROM movies m
         LEFT JOIN users u ON m.requested_by = u.id
         WHERE m.watched_at IS NULL`
      );
      const movies = moviesResult.rows;

      // Borda count for specified users
      const scores = new Map<number, number>(movies.map((m: any) => [m.id, 0]));

      if (userIds.length > 0) {
        const rankingsResult = await pool.query(
          `SELECT umr.user_id, umr.movie_id
           FROM user_movie_rankings umr
           JOIN movies m ON m.id = umr.movie_id
           WHERE umr.user_id = ANY($1::int[]) AND m.watched_at IS NULL
           ORDER BY umr.user_id, umr.rank ASC`,
          [userIds.map(Number)]
        );

        // Group by user, then apply Borda points
        const byUser = new Map<number, number[]>();
        for (const row of rankingsResult.rows) {
          if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
          byUser.get(row.user_id)!.push(row.movie_id);
        }
        for (const [, userMovieIds] of byUser) {
          const n = userMovieIds.length;
          for (let i = 0; i < n; i++) {
            const id = userMovieIds[i];
            if (scores.has(id)) scores.set(id, scores.get(id)! + (n - i));
          }
        }
      }

      return movies.sort((a: any, b: any) => {
        const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
        if (diff !== 0) return diff;
        return new Date(a.date_submitted).getTime() - new Date(b.date_submitted).getTime();
      });
    },
    kometaSchedule: async (_: any, __: any, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query('SELECT * FROM kometa_schedule WHERE id = 1');
      if (result.rows.length === 0) {
        return { enabled: false, frequency: 'daily', dailyTime: '03:00', collectionName: null, lastRunAt: null };
      }
      const row = result.rows[0];
      return {
        enabled: row.enabled,
        frequency: row.frequency,
        dailyTime: row.daily_time,
        collectionName: row.collection_name ?? null,
        lastRunAt: row.last_run_at ? (row.last_run_at instanceof Date ? row.last_run_at.toISOString() : new Date(row.last_run_at).toISOString()) : null,
      };
    },
  },
  Mutation: {
    addMovie: async (_: any, { title, tmdb_id }: { title: string; tmdb_id?: number }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      // rank = 0: no one has ranked this yet; Borda score starts at zero
      const insertResult = await pool.query(
        'INSERT INTO movies (title, requested_by, rank, tmdb_id) VALUES ($1, $2, 0, $3) RETURNING *',
        [title, context.user.userId, tmdb_id ?? null]
      );
      const userRow = await pool.query(
        'SELECT username, display_name FROM users WHERE id = $1',
        [context.user.userId]
      );
      const requesterName =
        userRow.rows[0]?.display_name || userRow.rows[0]?.username || context.user.username;
      await logAudit(
        context.user.userId,
        'MOVIE_ADD',
        'movie',
        String(insertResult.rows[0].id),
        { title, requester: requesterName },
        context.ipAddress
      );
      return {
        ...insertResult.rows[0],
        user_username: userRow.rows[0]?.username,
        user_display_name: userRow.rows[0]?.display_name,
      };
    },
    matchMovie: async (_: any, { id, tmdb_id, title }: { id: string; tmdb_id: number; title: string }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      const movieResult = await pool.query(
        `SELECT m.*, u.username AS user_username, u.display_name AS user_display_name
         FROM movies m
         LEFT JOIN users u ON m.requested_by = u.id
         WHERE m.id = $1`,
        [id]
      );
      const movie = movieResult.rows[0];
      if (!movie) {
        throw new GraphQLError('Movie not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      if (!context.user.isAdmin && movie.requested_by !== context.user.userId) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query(
        `UPDATE movies SET tmdb_id = $1, title = $2 WHERE id = $3
         RETURNING *`,
        [tmdb_id, title, id]
      );
      await logAudit(
        context.user.userId,
        'MOVIE_TMDB_MATCH',
        'movie',
        String(id),
        { original_title: movie.title, matched_title: title, tmdb_id },
        context.ipAddress ?? 'unknown'
      );
      return {
        ...result.rows[0],
        user_username: movie.user_username,
        user_display_name: movie.user_display_name,
      };
    },
    markWatched: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      const movieResult = await pool.query('SELECT * FROM movies WHERE id = $1', [id]);
      if (movieResult.rows.length === 0) {
        throw new GraphQLError('Movie not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      if (!context.user.isAdmin && movieResult.rows[0].requested_by !== context.user.userId) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const result = await pool.query(
        `UPDATE movies SET watched_at = NOW() WHERE id = $1
         RETURNING *`,
        [id]
      );
      if (result.rows.length === 0) {
        throw new GraphQLError('Movie not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      const movie = result.rows[0];
      const userRow = await pool.query(
        'SELECT username, display_name FROM users WHERE id = $1',
        [movie.requested_by]
      );
      await logAudit(
        context.user.userId,
        'MOVIE_WATCHED',
        'movie',
        String(id),
        { title: movie.title },
        context.ipAddress ?? 'unknown'
      );
      return {
        ...movie,
        user_username: userRow.rows[0]?.username,
        user_display_name: userRow.rows[0]?.display_name,
      };
    },
    deleteMovie: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const movieResult = await pool.query('SELECT title FROM movies WHERE id = $1', [id]);
      const movie = movieResult.rows[0];
      const result = await pool.query('DELETE FROM movies WHERE id = $1', [id]);
      if ((result.rowCount ?? 0) > 0) {
        await logAudit(
          context.user.userId,
          'MOVIE_DELETE',
          'movie',
          id,
          movie ? { title: movie.title } : null,
          context.ipAddress ?? 'unknown'
        );
      }
      return (result.rowCount ?? 0) > 0;
    },
    reorderMyMovie: async (_: any, { id, afterId }: { id: string; afterId?: string | null }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const userId = context.user.userId;

      const movieResult = await pool.query(
        'SELECT id, title FROM movies WHERE id = $1 AND watched_at IS NULL',
        [id]
      );
      if (movieResult.rows.length === 0) {
        throw new GraphQLError('Movie not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Fetch all other movies in this user's display order (ranked first, then unranked by date)
      // Also compute an effective rank for unranked movies so fractional indexing works across both groups.
      const othersResult = await pool.query(
        `SELECT m.id, umr.rank AS user_rank, m.date_submitted
         FROM movies m
         LEFT JOIN user_movie_rankings umr ON umr.movie_id = m.id AND umr.user_id = $1
         WHERE m.watched_at IS NULL AND m.id != $2
         ORDER BY umr.rank ASC NULLS LAST, m.date_submitted ASC`,
        [userId, id]
      );
      const others = othersResult.rows;

      // Assign effective ranks: real rank where available, synthetic rank for unranked tail
      let maxRealRank = 0;
      for (const m of others) {
        if (m.user_rank !== null) maxRealRank = Math.max(maxRealRank, Number(m.user_rank));
      }
      let unrankedOffset = 0;
      const effectiveRanks: number[] = others.map((m: any) => {
        if (m.user_rank !== null) return Number(m.user_rank);
        return maxRealRank + 1 + unrankedOffset++;
      });

      let newRank: number;
      if (!afterId) {
        newRank = effectiveRanks.length > 0 ? effectiveRanks[0] / 2 : 1;
      } else {
        const afterIndex = others.findIndex((m: any) => String(m.id) === String(afterId));
        if (afterIndex === -1) {
          throw new GraphQLError('afterId not found', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        const afterRank = effectiveRanks[afterIndex];
        const nextRank = effectiveRanks[afterIndex + 1];
        newRank = nextRank !== undefined ? (afterRank + nextRank) / 2 : afterRank + 1;
      }

      await pool.query(
        `INSERT INTO user_movie_rankings (user_id, movie_id, rank)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, movie_id) DO UPDATE SET rank = $3, updated_at = NOW()`,
        [userId, id, newRank]
      );

      await logAudit(
        userId,
        'MOVIE_REORDER',
        'movie',
        String(id),
        { title: movieResult.rows[0].title, afterId: afterId ?? null },
        context.ipAddress ?? 'unknown'
      );

      scheduleBordaRecalculation();
      return true;
    },
    exportKometa: async (
      _: any,
      { collectionName }: { collectionName?: string },
      context: any
    ) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (!isProduction()) {
        throw new GraphQLError('Kometa export is disabled outside of production', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const collectionsPath = process.env.KOMETA_COLLECTIONS_PATH;
      if (!collectionsPath) {
        throw new GraphQLError('KOMETA_COLLECTIONS_PATH is not configured', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const moviesResult = await pool.query(
        'SELECT title, tmdb_id, rank FROM movies WHERE watched_at IS NULL ORDER BY rank DESC NULLS LAST, date_submitted ASC'
      );
      const movies = moviesResult.rows;
      const matched = movies.filter((m: any) => m.tmdb_id != null);

      if (matched.length === 0) {
        throw new GraphQLError('No movies with TMDB IDs to export', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const name = collectionName || 'MovieNight Watchlist';
      const today = new Date().toISOString().split('T')[0];
      const idLines = matched.map((m: any) => `      - ${m.tmdb_id}`).join('\n');
      const yaml =
        `## MovieNight Collection — auto-exported ${today}\n` +
        `## Generated by MovieNight admin panel. Do not edit manually.\n` +
        `collections:\n` +
        `  ${name}:\n` +
        `    tmdb_movie:\n` +
        `${idLines}\n` +
        `    collection_order: custom\n` +
        `    sync_mode: sync\n` +
        `    radarr_add_missing: true\n` +
        `    radarr_search: true\n` +
        `    visible_home: true\n` +
        `    visible_shared: true\n` +
        `    summary: "MovieNight watchlist — exported ${today}"\n`;

      const filePath = path.join(collectionsPath, 'movienight.yml');
      await fs.promises.writeFile(filePath, yaml, 'utf8');

      let triggered = false;
      let triggerError: string | undefined;
      const triggerUrl = process.env.KOMETA_TRIGGER_URL;
      if (triggerUrl) {
        try {
          await fetch(triggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'run', collection: name }),
            signal: AbortSignal.timeout(10000),
          });
          triggered = true;
        } catch (err: any) {
          triggerError = err.message;
        }
      }

      await logAudit(
        context.user.userId,
        'KOMETA_EXPORT',
        'kometa',
        filePath,
        { count: matched.length, skipped: movies.length - matched.length, triggered, triggerError },
        context.ipAddress ?? 'unknown'
      );

      return { filePath, triggered, triggerError: triggerError ?? null };
    },
    updateKometaSchedule: async (
      _: any,
      { enabled, frequency, dailyTime, collectionName }: {
        enabled?: boolean;
        frequency?: string;
        dailyTime?: string;
        collectionName?: string;
      },
      context: any
    ) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (enabled === true && !isProduction()) {
        throw new GraphQLError('Scheduled Kometa export cannot be enabled outside of production', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (frequency !== undefined && frequency !== 'hourly' && frequency !== 'daily') {
        throw new GraphQLError('frequency must be "hourly" or "daily"', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      if (dailyTime !== undefined && !/^\d{2}:\d{2}$/.test(dailyTime)) {
        throw new GraphQLError('dailyTime must be in HH:MM format', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const sets: string[] = [];
      const values: any[] = [];
      let i = 1;

      if (enabled !== undefined) { sets.push(`enabled = $${i++}`); values.push(enabled); }
      if (frequency !== undefined) { sets.push(`frequency = $${i++}`); values.push(frequency); }
      if (dailyTime !== undefined) { sets.push(`daily_time = $${i++}`); values.push(dailyTime); }
      if (collectionName !== undefined) { sets.push(`collection_name = $${i++}`); values.push(collectionName || null); }
      sets.push(`updated_at = NOW()`);
      values.push(1);

      await pool.query(
        `UPDATE kometa_schedule SET ${sets.join(', ')} WHERE id = $${i}`,
        values
      );

      const result = await pool.query('SELECT * FROM kometa_schedule WHERE id = 1');
      const row = result.rows[0];

      rescheduleKometa(row.enabled, row.frequency, row.daily_time);

      return {
        enabled: row.enabled,
        frequency: row.frequency,
        dailyTime: row.daily_time,
        collectionName: row.collection_name ?? null,
        lastRunAt: row.last_run_at ? (row.last_run_at instanceof Date ? row.last_run_at.toISOString() : new Date(row.last_run_at).toISOString()) : null,
      };
    },
    importFromLetterboxd: async (_: any, { url }: { url: string }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate URL is a Letterboxd list
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new GraphQLError('Invalid URL', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if (parsedUrl.hostname !== 'letterboxd.com' && parsedUrl.hostname !== 'www.letterboxd.com') {
        throw new GraphQLError('URL must be a letterboxd.com list', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const films: { title: string; year: number | null }[] = [];
      const errors: string[] = [];

      function decodeEntities(s: string): string {
        return s
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      }

      function extractFilms(html: string): { title: string; year: number | null }[] {
        const found: { title: string; year: number | null }[] = [];
        // data-item-name="Once Upon a Time... in Hollywood (2019)"
        for (const m of html.matchAll(/data-item-name="([^"]+)"/g)) {
          const raw = decodeEntities(m[1]);
          const yearMatch = raw.match(/\((\d{4})\)$/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
          const title = raw.replace(/\s*\(\d{4}\)$/, '').trim();
          if (title) found.push({ title, year });
        }
        return found;
      }

      // Fetch all pages of the list
      const baseUrl = url.replace(/\/$/, '');
      for (let page = 1; page <= 100; page++) {
        const pageUrl = page === 1 ? `${baseUrl}/` : `${baseUrl}/page/${page}/`;
        let html: string;
        try {
          const response = await fetch(pageUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
          });
          if (response.status === 404) break;
          if (!response.ok) {
            errors.push(`Page ${page}: HTTP ${response.status}`);
            break;
          }
          html = await response.text();
        } catch (err: any) {
          errors.push(`Page ${page}: ${err.message}`);
          break;
        }

        const pageFilms = extractFilms(html);
        if (pageFilms.length === 0) break;
        films.push(...pageFilms);
      }

      if (films.length === 0 && errors.length === 0) {
        errors.push('No films found — check that the URL is a public Letterboxd list');
      }

      // TMDB lookup helper (best-effort, silently skips if no API key)
      const tmdbApiKey = process.env.TMDB_API_KEY;
      async function lookupTmdbId(title: string, year: number | null): Promise<number | null> {
        if (!tmdbApiKey) return null;
        try {
          const params = new URLSearchParams({
            api_key: tmdbApiKey,
            query: title,
            language: 'en-US',
            page: '1',
            ...(year ? { year: String(year) } : {}),
          });
          const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
          if (!res.ok) return null;
          const data = await res.json() as any;
          return data.results?.[0]?.id ?? null;
        } catch {
          return null;
        }
      }

      // Get existing titles (dedup check)
      const existingResult = await pool.query('SELECT LOWER(title) AS title FROM movies');
      const existingTitles = new Set(existingResult.rows.map((r: any) => r.title));

      let imported = 0;
      let skipped = 0;
      let tmdb_matched = 0;

      for (const { title, year } of films) {
        if (existingTitles.has(title.toLowerCase())) {
          skipped++;
          continue;
        }
        const tmdbId = await lookupTmdbId(title, year);
        if (tmdbId) tmdb_matched++;
        try {
          // rank = 0: Borda score starts at zero (no one has ranked this yet)
          await pool.query(
            'INSERT INTO movies (title, requested_by, rank, tmdb_id) VALUES ($1, $2, 0, $3)',
            [title, context.user.userId, tmdbId]
          );
          existingTitles.add(title.toLowerCase());
          imported++;
        } catch (err: any) {
          errors.push(`"${title}": ${err.message}`);
        }
      }

      await logAudit(
        context.user.userId,
        'LETTERBOXD_IMPORT',
        'movie',
        null,
        { url, imported, skipped, tmdb_matched, errors: errors.length },
        context.ipAddress ?? 'unknown'
      );

      return { imported, skipped, tmdb_matched, errors };
    },
    login: async (
      _: any,
      { username, password }: { username: string; password: string },
      context: any
    ) => {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = result.rows[0];

      if (!user) {
        await logLoginHistory(null, context.ipAddress, context.userAgent, false);
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        await logLoginHistory(user.id, context.ipAddress, context.userAgent, false);
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!user.is_active) {
        await logLoginHistory(user.id, context.ipAddress, context.userAgent, false);
        throw new GraphQLError('Account is disabled', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
      await logLoginHistory(user.id, context.ipAddress, context.userAgent, true);
      await logAudit(user.id, 'LOGIN_SUCCESS', null, null, null, context.ipAddress);

      const userWithoutPassword: User = {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        is_admin: user.is_admin,
        is_active: user.is_active,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      const token = generateToken(userWithoutPassword);
      return { token, user: userWithoutPassword };
    },
    createUser: async (_: any, args: CreateUserInput, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      const passwordHash = await hashPassword(args.password);
      const isActive = args.is_active !== false;
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${USER_COLS}`,
        [
          args.username,
          args.email,
          passwordHash,
          args.display_name || null,
          args.is_admin || false,
          isActive,
        ]
      );
      await logAudit(
        context.user.userId,
        'USER_CREATE',
        'user',
        String(result.rows[0].id),
        { username: args.username, email: args.email, is_admin: args.is_admin || false },
        context.ipAddress
      );
      return result.rows[0];
    },
    updateUser: async (_: any, args: UpdateUserInput, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      const changes: Record<string, any> = {};

      if (args.username !== undefined) {
        updates.push(`username = $${paramCount++}`);
        values.push(args.username);
        changes.username = args.username;
      }
      if (args.email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(args.email);
        changes.email = args.email;
      }
      if (args.password !== undefined) {
        const passwordHash = await hashPassword(args.password);
        updates.push(`password_hash = $${paramCount++}`);
        values.push(passwordHash);
        changes.password = '[changed]';
      }
      if (args.display_name !== undefined) {
        updates.push(`display_name = $${paramCount++}`);
        values.push(args.display_name || null);
        changes.display_name = args.display_name;
      }
      if (args.is_admin !== undefined) {
        updates.push(`is_admin = $${paramCount++}`);
        values.push(args.is_admin);
        changes.is_admin = args.is_admin;
      }
      if (args.is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(args.is_active);
        changes.is_active = args.is_active;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(args.id);

      const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING ${USER_COLS}`,
        values
      );
      await logAudit(
        context.user.userId,
        'USER_UPDATE',
        'user',
        String(args.id),
        changes,
        context.ipAddress
      );
      return result.rows[0];
    },
    deleteUser: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user?.isAdmin) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      if (context.user.userId === parseInt(id)) {
        throw new GraphQLError('Cannot delete your own account', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const targetResult = await pool.query(
        'SELECT username, email FROM users WHERE id = $1',
        [id]
      );
      const targetUser = targetResult.rows[0];

      const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
      if ((result.rowCount ?? 0) > 0 && targetUser) {
        await logAudit(
          context.user.userId,
          'USER_DELETE',
          'user',
          id,
          { username: targetUser.username, email: targetUser.email },
          context.ipAddress
        );
      }
      return (result.rowCount ?? 0) > 0;
    },
  },
  Movie: {
    requester: (parent: any) => {
      if (parent.requested_by != null) {
        return parent.user_display_name || parent.user_username || parent.requester || 'Unknown';
      }
      return parent.requester || 'Unknown';
    },
    date_submitted: (parent: any) => {
      const date =
        parent.date_submitted instanceof Date
          ? parent.date_submitted
          : new Date(Number(parent.date_submitted));
      return date.toISOString();
    },
    watched_at: (parent: any) => {
      if (!parent.watched_at) return null;
      const date =
        parent.watched_at instanceof Date
          ? parent.watched_at
          : new Date(parent.watched_at);
      return date.toISOString();
    },
  },
  User: {
    created_at: (parent: any) => {
      const date =
        parent.created_at instanceof Date
          ? parent.created_at
          : new Date(Number(parent.created_at));
      return date.toISOString();
    },
    updated_at: (parent: any) => {
      const date =
        parent.updated_at instanceof Date
          ? parent.updated_at
          : new Date(Number(parent.updated_at));
      return date.toISOString();
    },
    last_login_at: (parent: any) => {
      if (!parent.last_login_at) return null;
      const date =
        parent.last_login_at instanceof Date
          ? parent.last_login_at
          : new Date(Number(parent.last_login_at));
      return date.toISOString();
    },
  },
  AuditLog: {
    created_at: (parent: any) => {
      const date =
        parent.created_at instanceof Date
          ? parent.created_at
          : new Date(Number(parent.created_at));
      return date.toISOString();
    },
    metadata: (parent: any) => {
      if (parent.metadata === null || parent.metadata === undefined) return null;
      return typeof parent.metadata === 'string'
        ? parent.metadata
        : JSON.stringify(parent.metadata);
    },
  },
  LoginHistory: {
    created_at: (parent: any) => {
      const date =
        parent.created_at instanceof Date
          ? parent.created_at
          : new Date(Number(parent.created_at));
      return date.toISOString();
    },
  },
};
