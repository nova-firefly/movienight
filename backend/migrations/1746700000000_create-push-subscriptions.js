/**
 * Web Push subscriptions
 *
 * Stores one row per active PushSubscription returned by the browser's
 * pushManager.subscribe(). Endpoint is globally unique per the Push API
 * spec (RFC 8030) — same browser re-subscribing upserts on `endpoint`;
 * a user with multiple devices gets multiple rows naturally.
 *
 * Endpoint, p256dh, and auth are capability material — never log them.
 */

exports.up = (pgm) => {
  pgm.createTable('push_subscriptions', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    endpoint: {
      type: 'text',
      notNull: true,
    },
    p256dh: {
      type: 'text',
      notNull: true,
    },
    auth: {
      type: 'text',
      notNull: true,
    },
    user_agent: {
      type: 'text',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    last_used_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    failure_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
  });

  pgm.addConstraint('push_subscriptions', 'push_subscriptions_endpoint_unique', {
    unique: ['endpoint'],
  });

  pgm.createIndex('push_subscriptions', ['user_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('push_subscriptions');
};
