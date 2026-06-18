import fs from 'fs';
import path from 'path';
import pool from './db';

let backupTimeout: ReturnType<typeof setTimeout> | null = null;

export interface BackupData {
  version: number;
  exported_at: string;
  movies: any[];
  users: any[];
  kometa_schedule: any[];
}

export async function runBackup(): Promise<string> {
  const backupPath = process.env.DB_BACKUP_PATH;
  if (!backupPath) throw new Error('DB_BACKUP_PATH not configured');

  await fs.promises.mkdir(backupPath, { recursive: true });

  const [movies, users, schedule] = await Promise.all([
    pool.query('SELECT * FROM movies ORDER BY rank'),
    pool.query('SELECT * FROM users ORDER BY id'),
    pool.query('SELECT * FROM kometa_schedule ORDER BY id'),
  ]);

  const data: BackupData = {
    version: 1,
    exported_at: new Date().toISOString(),
    movies: movies.rows,
    users: users.rows,
    kometa_schedule: schedule.rows,
  };

  const ts = new Date().toISOString().slice(0, 19).replace(/T/, '_').replace(/:/g, '');
  const filename = `movienight_${ts}.json`;
  const filePath = path.join(backupPath, filename);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

  // Prune backups older than DB_BACKUP_KEEP_DAYS
  const keepDays = parseInt(process.env.DB_BACKUP_KEEP_DAYS || '7', 10);
  const cutoff = Date.now() - keepDays * 86_400_000;
  for (const file of await fs.promises.readdir(backupPath)) {
    if (!file.startsWith('movienight_') || !file.endsWith('.json')) continue;
    const fp = path.join(backupPath, file);
    const stat = await fs.promises.stat(fp);
    if (stat.mtimeMs < cutoff) await fs.promises.unlink(fp);
  }

  console.log(`[Backup] Saved: ${filename}`);
  return filename;
}

function getMsUntilNext(): number {
  const schedule = process.env.DB_BACKUP_SCHEDULE || 'daily';
  const dailyTime = process.env.DB_BACKUP_TIME || '03:00';
  const now = new Date();

  if (schedule === 'hourly') {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.getTime() - now.getTime();
  }

  const [hours, minutes] = dailyTime.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleNext(): void {
  const ms = getMsUntilNext();
  console.log(`[Backup] Next scheduled backup in ~${Math.round(ms / 60_000)} minute(s)`);

  backupTimeout = setTimeout(async () => {
    backupTimeout = null;
    try {
      await runBackup();
    } catch (err) {
      console.error('[Backup] Scheduled backup failed:', err);
    }
    scheduleNext();
  }, ms);

  if (backupTimeout.unref) backupTimeout.unref();
}

export function initBackupScheduler(): void {
  if (!process.env.DB_BACKUP_PATH) {
    console.log('[Backup] DB_BACKUP_PATH not set, scheduler disabled');
    return;
  }
  const schedule = process.env.DB_BACKUP_SCHEDULE || 'daily';
  console.log(`[Backup] Scheduler enabled (${schedule})`);
  scheduleNext();
}
