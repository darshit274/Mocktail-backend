'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tests', {
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
      sub_category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sub_categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      title_gujarati: {
        type: Sequelize.STRING,
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
      duration_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 60
      },
      total_marks: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      is_demo: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_free_in_paid_series: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      negative_marking_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      negative_marks_per_wrong: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0.25
      },
      is_one_time_only: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      max_duration_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      attempt_restrictions: {
        type: Sequelize.JSON,
        allowNull: true
      },
      passing_marks: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      instructions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      instructions_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      difficulty_level: {
        type: Sequelize.ENUM('easy', 'medium', 'hard'),
        defaultValue: 'medium'
      },
      randomize_questions: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      show_results_immediately: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      pass_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 60.00
      },
      allow_review: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      total_questions: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      display_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
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
    await queryInterface.addIndex('tests', ['uuid']);
    await queryInterface.addIndex('tests', ['sub_category_id']);
    await queryInterface.addIndex('tests', ['is_active']);
    await queryInterface.addIndex('tests', ['is_demo']);
    await queryInterface.addIndex('tests', ['difficulty_level']);
    await queryInterface.addIndex('tests', ['display_order']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('tests');
  }
};