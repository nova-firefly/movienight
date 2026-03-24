exports.up = (pgm) => {
  pgm.addColumn('users', {
    display_name: {
      type: 'varchar(255)',
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'display_name');
};
