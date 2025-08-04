'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add advanced features to tests table
    await queryInterface.addColumn('tests', 'is_demo', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('tests', 'is_free_in_paid_series', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('tests', 'negative_marking_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('tests', 'negative_marks_per_wrong', {
      type: Sequelize.DECIMAL(3, 2),
      defaultValue: 0.25,
      allowNull: false
    });

    await queryInterface.addColumn('tests', 'is_one_time_only', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('tests', 'max_duration_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('tests', 'passing_marks', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('tests', 'instructions', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('tests', 'instructions_gujarati', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('tests', 'attempt_restrictions', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove advanced test features
    await queryInterface.removeColumn('tests', 'is_demo');
    await queryInterface.removeColumn('tests', 'is_free_in_paid_series');
    await queryInterface.removeColumn('tests', 'negative_marking_enabled');
    await queryInterface.removeColumn('tests', 'negative_marks_per_wrong');
    await queryInterface.removeColumn('tests', 'is_one_time_only');
    await queryInterface.removeColumn('tests', 'max_duration_minutes');
    await queryInterface.removeColumn('tests', 'passing_marks');
    await queryInterface.removeColumn('tests', 'instructions');
    await queryInterface.removeColumn('tests', 'instructions_gujarati');
    await queryInterface.removeColumn('tests', 'attempt_restrictions');
  }
};