exports.up = (pgm) => {
  pgm.createTable('audit_logs', {
    id: 'id',
    actor_id: {
      type: 'integer',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    action: {
      type: 'varchar(64)',
      notNull: true,
    },
    target_type: {
      type: 'varchar(32)',
    },
    target_id: {
      type: 'text',
    },
    metadata: {
      type: 'jsonb',
    },
    ip_address: {
      type: 'varchar(45)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('audit_logs', 'actor_id');
  pgm.createIndex('audit_logs', 'created_at');
  pgm.createIndex('audit_logs', 'action');
};

exports.down = (pgm) => {
  pgm.dropTable('audit_logs');
};
