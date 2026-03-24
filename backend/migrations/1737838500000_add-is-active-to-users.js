exports.up = (pgm) => {
  pgm.addColumn('users', {
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'is_active');
};
