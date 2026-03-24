exports.up = (pgm) => {
  pgm.addColumn('users', {
    last_login_at: {
      type: 'timestamp',
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'last_login_at');
};
