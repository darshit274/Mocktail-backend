'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('tests', 'title_gujarati', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Test title in Gujarati language'
    });

    await queryInterface.addColumn('tests', 'description_gujarati', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Test description in Gujarati language'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('tests', 'title_gujarati');
    await queryInterface.removeColumn('tests', 'description_gujarati');
  }
};
