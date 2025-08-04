'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('test_series', 'name_gujarati', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Test series name in Gujarati language'
    });

    await queryInterface.addColumn('test_series', 'description_gujarati', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Test series description in Gujarati language'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('test_series', 'name_gujarati');
    await queryInterface.removeColumn('test_series', 'description_gujarati');
  }
};
