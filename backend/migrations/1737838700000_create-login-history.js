exports.up = (pgm) => {
  pgm.createTable('login_history', {
    id: 'id',
    user_id: {
      type: 'integer',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    ip_address: {
      type: 'varchar(45)',
    },
    user_agent: {
      type: 'text',
    },
    succeeded: {
      type: 'boolean',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('login_history', 'user_id');
  pgm.createIndex('login_history', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('login_history');
};
