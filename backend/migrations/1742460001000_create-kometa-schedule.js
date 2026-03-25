/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('kometa_schedule', {
    id: 'id',
    enabled: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    frequency: {
      type: 'varchar(16)',
      notNull: true,
      default: 'daily',
    },
    daily_time: {
      type: 'varchar(5)',
      notNull: true,
      default: '03:00',
    },
    collection_name: {
      type: 'varchar(255)',
    },
    last_run_at: {
      type: 'timestamp',
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Insert the single config row
  pgm.sql(`INSERT INTO kometa_schedule (enabled, frequency, daily_time) VALUES (false, 'daily', '03:00')`);
};

exports.down = (pgm) => {
  pgm.dropTable('kometa_schedule');
};
