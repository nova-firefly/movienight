/**
 * Per-user notification preferences
 *
 * One row per (user, event_type) override. Absent row = enabled by default,
 * which avoids backfilling rows for every existing user. To disable an
 * event the app upserts a row with enabled=false; re-enabling either
 * deletes the row or sets enabled=true.
 *
 * event_type values are validated against a whitelist in resolvers
 * (currently: 'MOVIE_ADD'). New notification types are added by extending
 * the whitelist — no migration needed.
 */

exports.up = (pgm) => {
  pgm.createTable('user_notification_preferences', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    event_type: {
      type: 'varchar(64)',
      notNull: true,
    },
    enabled: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('user_notification_preferences', 'user_notification_preferences_unique', {
    unique: ['user_id', 'event_type'],
  });

  pgm.createIndex('user_notification_preferences', ['user_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('user_notification_preferences');
};
