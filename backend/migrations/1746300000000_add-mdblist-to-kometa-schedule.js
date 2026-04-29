/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('kometa_schedule', {
    mdblist_list_id: {
      type: 'integer',
    },
    mdblist_list_url: {
      type: 'text',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('kometa_schedule', ['mdblist_list_id', 'mdblist_list_url']);
};
