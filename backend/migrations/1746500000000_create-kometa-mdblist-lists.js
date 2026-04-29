/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('kometa_mdblist_lists', {
    id: 'id',
    list_type: { type: 'varchar(20)', notNull: true },
    ref_id: { type: 'integer', notNull: true },
    list_name: { type: 'varchar(255)', notNull: true },
    mdblist_list_id: { type: 'integer' },
    mdblist_list_url: { type: 'text' },
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
  pgm.addConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_unique', {
    unique: ['list_type', 'ref_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('kometa_mdblist_lists');
};
