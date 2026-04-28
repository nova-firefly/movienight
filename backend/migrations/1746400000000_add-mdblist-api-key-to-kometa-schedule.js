/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('kometa_schedule', {
    mdblist_api_key: {
      type: 'text',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('kometa_schedule', ['mdblist_api_key']);
};
