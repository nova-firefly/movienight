exports.up = (pgm) => {
  pgm.createTable('password_reset_tokens', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    token_hash: {
      type: 'varchar(64)',
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    used_at: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('password_reset_tokens', 'user_id');
  pgm.createIndex('password_reset_tokens', 'token_hash');
};

exports.down = (pgm) => {
  pgm.dropTable('password_reset_tokens');
};
