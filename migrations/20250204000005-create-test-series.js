'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('new_test_series', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      name_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      pricing_type: {
        type: Sequelize.ENUM('free', 'paid'),
        defaultValue: 'free',
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(10),
        defaultValue: 'INR',
        allowNull: false
      },
      demo_tests_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      subscription_duration_days: {
        type: Sequelize.INTEGER,
        defaultValue: 365,
        allowNull: false
      },
      features: {
        type: Sequelize.JSON,
        allowNull: true
      },
      discount_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0.00,
        allowNull: false
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      difficulty_level: {
        type: Sequelize.ENUM('beginner', 'intermediate', 'advanced'),
        defaultValue: 'beginner',
        allowNull: false
      },
      free_test_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      max_attempts_per_test: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false
      },
      has_negative_marking: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      negative_marks: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0.25,
        allowNull: true
      },
      supports_pause_resume: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      supports_multilanguage: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('new_test_series', ['uuid']);
    await queryInterface.addIndex('new_test_series', ['is_active']);
    await queryInterface.addIndex('new_test_series', ['pricing_type']);
    await queryInterface.addIndex('new_test_series', ['is_featured']);
    await queryInterface.addIndex('new_test_series', ['difficulty_level']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('new_test_series');
  }
};