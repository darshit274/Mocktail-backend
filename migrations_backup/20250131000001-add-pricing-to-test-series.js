'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add subscription-related fields to new_test_series table
    await queryInterface.addColumn('new_test_series', 'pricing_type', {
      type: Sequelize.ENUM('free', 'paid'),
      defaultValue: 'free',
      allowNull: false
    });

    await queryInterface.addColumn('new_test_series', 'price', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0.00,
      allowNull: false
    });

    await queryInterface.addColumn('new_test_series', 'currency', {
      type: Sequelize.STRING(10),
      defaultValue: 'INR',
      allowNull: false
    });

    await queryInterface.addColumn('new_test_series', 'demo_tests_count', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('new_test_series', 'subscription_duration_days', {
      type: Sequelize.INTEGER,
      defaultValue: 365,
      allowNull: false
    });

    await queryInterface.addColumn('new_test_series', 'features', {
      type: Sequelize.JSON,
      allowNull: true
    });

    await queryInterface.addColumn('new_test_series', 'discount_percentage', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0.00,
      allowNull: false
    });

    await queryInterface.addColumn('new_test_series', 'is_featured', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove subscription-related fields
    await queryInterface.removeColumn('new_test_series', 'pricing_type');
    await queryInterface.removeColumn('new_test_series', 'price');
    await queryInterface.removeColumn('new_test_series', 'currency');
    await queryInterface.removeColumn('new_test_series', 'demo_tests_count');
    await queryInterface.removeColumn('new_test_series', 'subscription_duration_days');
    await queryInterface.removeColumn('new_test_series', 'features');
    await queryInterface.removeColumn('new_test_series', 'discount_percentage');
    await queryInterface.removeColumn('new_test_series', 'is_featured');
  }
};