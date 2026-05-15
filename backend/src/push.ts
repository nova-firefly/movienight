import webpush, { WebPushError } from 'web-push';
import pool from './db';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface SubscriptionRow {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const MAX_FAILURE_COUNT = 5;

let configured = false;

export function isPushConfigured(): boolean {
  return configured;
}

export function configurePush(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@movienight.local';

  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not set — Web Push disabled.');
    configured = false;
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return true;
  } catch (err) {
    console.error('Failed to configure Web Push:', err);
    configured = false;
    return false;
  }
}

async function deliverOne(row: SubscriptionRow, payload: PushPayload): Promise<'ok' | 'pruned'> {
  const subscription = {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    await pool.query(
      'UPDATE push_subscriptions SET last_used_at = NOW(), failure_count = 0 WHERE id = $1',
      [row.id],
    );
    return 'ok';
  } catch (err) {
    const status = err instanceof WebPushError ? err.statusCode : 0;
    if (status === 404 || status === 410) {
      await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
      console.warn(`Push subscription ${row.id} pruned (status ${status}).`);
      return 'pruned';
    }
    const updated = await pool.query(
      'UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = $1 RETURNING failure_count',
      [row.id],
    );
    const newCount = updated.rows[0]?.failure_count ?? 0;
    if (newCount >= MAX_FAILURE_COUNT) {
      await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
      console.warn(
        `Push subscription ${row.id} pruned after ${newCount} consecutive failures (last status ${status}).`,
      );
      return 'pruned';
    }
    console.warn(`Push delivery failed for subscription ${row.id} (status ${status}).`);
    return 'ok';
  }
}

export async function sendPushToUser(
  userId: number,
  payload: PushPayload,
): Promise<{ delivered: number; pruned: number }> {
  if (!configured) return { delivered: 0, pruned: 0 };

  const { rows } = await pool.query<SubscriptionRow>(
    'SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );

  return fanOut(rows, payload);
}

export async function sendPushToUsersExcept(
  excludeUserId: number,
  eventType: string,
  payload: PushPayload,
): Promise<{ delivered: number; pruned: number }> {
  if (!configured) return { delivered: 0, pruned: 0 };

  const { rows } = await pool.query<SubscriptionRow>(
    `SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth
     FROM push_subscriptions s
     WHERE s.user_id != $1
       AND NOT EXISTS (
         SELECT 1 FROM user_notification_preferences p
         WHERE p.user_id = s.user_id
           AND p.event_type = $2
           AND p.enabled = false
       )`,
    [excludeUserId, eventType],
  );

  return fanOut(rows, payload);
}

async function fanOut(
  rows: SubscriptionRow[],
  payload: PushPayload,
): Promise<{ delivered: number; pruned: number }> {
  const results = await Promise.allSettled(rows.map((row) => deliverOne(row, payload)));
  let delivered = 0;
  let pruned = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value === 'ok') delivered++;
      else pruned++;
    }
  }
  return { delivered, pruned };
}
