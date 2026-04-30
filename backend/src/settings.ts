import pool from './db';

export async function getSetting(key: string): Promise<string | null> {
  const result = await pool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  return result.rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value],
  );
}
