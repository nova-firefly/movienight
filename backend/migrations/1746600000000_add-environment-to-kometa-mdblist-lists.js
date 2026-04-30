exports.up = (pgm) => {
  pgm.addColumn('kometa_mdblist_lists', {
    environment: {
      type: 'varchar(20)',
      notNull: true,
      default: "'production'",
    },
  });

  // Drop old unique constraint, create new one including environment
  pgm.dropConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_unique');
  pgm.addConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_env_unique', {
    unique: ['list_type', 'ref_id', 'environment'],
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_env_unique');
  pgm.addConstraint('kometa_mdblist_lists', 'kometa_mdblist_lists_type_ref_unique', {
    unique: ['list_type', 'ref_id'],
  });
  pgm.dropColumn('kometa_mdblist_lists', 'environment');
};
