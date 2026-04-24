exports.up = (pgm) => {
  pgm.createTable('user_connections', {
    id: 'id',
    requester_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    addressee_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: "'pending'",
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

  pgm.addConstraint(
    'user_connections',
    'user_connections_status_check',
    "CHECK (status IN ('pending', 'accepted', 'rejected'))",
  );
  pgm.addConstraint(
    'user_connections',
    'user_connections_no_self',
    'CHECK (requester_id <> addressee_id)',
  );
  pgm.addConstraint(
    'user_connections',
    'user_connections_unique_pair',
    'UNIQUE (requester_id, addressee_id)',
  );

  pgm.createIndex('user_connections', 'requester_id');
  pgm.createIndex('user_connections', 'addressee_id');
  pgm.createIndex('user_connections', ['addressee_id', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable('user_connections');
};
