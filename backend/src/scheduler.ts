import pool from './db';
import { runKometaExport } from './kometaExport';

// ── Kometa export scheduler ────────────────────────────────────────────────────

let scheduledTimeout: ReturnType<typeof setTimeout> | null = null;

async function runKometaExportScheduled(): Promise<void> {
  const collectionsPath = process.env.KOMETA_COLLECTIONS_PATH;
  if (!collectionsPath) {
    console.error('[Kometa Scheduler] KOMETA_COLLECTIONS_PATH not configured, skipping');
    return;
  }

  try {
    const settingsResult = await pool.query('SELECT * FROM kometa_schedule WHERE id = 1');
    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].enabled) return;
    const settings = settingsResult.rows[0];

    const mdblistApiKey = settings.mdblist_api_key || process.env.MDBLIST_API_KEY;
    if (!mdblistApiKey) {
      console.error('[Kometa Scheduler] MDBList API key not configured, skipping');
      return;
    }

    const { filePath, lists } = await runKometaExport(collectionsPath, mdblistApiKey);

    if (lists.length > 0) {
      await pool.query('UPDATE kometa_schedule SET last_run_at = NOW() WHERE id = 1');

      const totalMovies = lists.reduce((sum, l) => sum + l.movieCount, 0);
      await pool.query(
        'INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          null,
          'KOMETA_SCHEDULE_EXPORT',
          'kometa',
          filePath,
          JSON.stringify({
            listCount: lists.length,
            totalMovies,
            lists: lists.map((l) => ({ name: l.name, type: l.type, count: l.movieCount })),
            scheduled: true,
          }),
          'scheduler',
        ],
      );

      console.log(
        `[Kometa Scheduler] Exported ${lists.length} lists (${totalMovies} movies) to ${filePath}`,
      );
    } else {
      console.log('[Kometa Scheduler] No combined/solo lists to export, skipping');
    }
  } catch (err) {
    console.error('[Kometa Scheduler] Export failed:', err);
  }
}

function getMsUntilNext(frequency: string, dailyTime: string): number {
  const now = new Date();

  if (frequency === 'hourly') {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.getTime() - now.getTime();
  }

  // daily: parse HH:MM
  const [hours, minutes] = dailyTime.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function scheduleNext(frequency: string, dailyTime: string): void {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
  }

  const ms = getMsUntilNext(frequency, dailyTime);
  const mins = Math.round(ms / 60000);
  console.log(`[Kometa Scheduler] Next export in ~${mins} minute(s)`);

  scheduledTimeout = setTimeout(async () => {
    scheduledTimeout = null;
    // Re-read settings in case they changed
    const result = await pool.query('SELECT * FROM kometa_schedule WHERE id = 1');
    if (result.rows.length > 0 && result.rows[0].enabled) {
      await runKometaExportScheduled();
      scheduleNext(result.rows[0].frequency, result.rows[0].daily_time);
    }
  }, ms);

  // Allow Node process to exit even if timer is pending
  if (scheduledTimeout.unref) scheduledTimeout.unref();
}

export async function initScheduler(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Kometa Scheduler] Disabled (non-production environment)');
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM kometa_schedule WHERE id = 1');
    if (result.rows.length === 0) return;
    const settings = result.rows[0];

    if (settings.enabled) {
      console.log(`[Kometa Scheduler] Starting (${settings.frequency})`);
      scheduleNext(settings.frequency, settings.daily_time);
    } else {
      console.log('[Kometa Scheduler] Disabled, not starting');
    }
  } catch (err) {
    console.error('[Kometa Scheduler] Failed to initialize:', err);
  }
}

export function rescheduleKometa(enabled: boolean, frequency: string, dailyTime: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Kometa Scheduler] Reschedule skipped (non-production environment)');
    return;
  }

  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
  }

  if (enabled) {
    console.log(`[Kometa Scheduler] Rescheduling (${frequency})`);
    scheduleNext(frequency, dailyTime);
  } else {
    console.log('[Kometa Scheduler] Disabled');
  }
}
