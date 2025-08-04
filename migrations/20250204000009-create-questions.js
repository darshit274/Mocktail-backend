'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('questions', {
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
      test_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tests',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      question: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      options: {
        type: Sequelize.JSON,
        allowNull: false
      },
      correct_option: {
        type: Sequelize.STRING(1),
        allowNull: false
      },
      explanation: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      question_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      options_gujarati: {
        type: Sequelize.JSON,
        allowNull: true
      },
      explanation_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      subject: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      topic: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      sub_topic: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      difficulty: {
        type: Sequelize.ENUM('easy', 'medium', 'hard', 'expert'),
        defaultValue: 'medium'
      },
      marks: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      negative_marks: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0
      },
      image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      audio_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      time_limit: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      is_mandatory: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      display_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      total_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      correct_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      average_time: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
    await queryInterface.addIndex('questions', ['uuid']);
    await queryInterface.addIndex('questions', ['test_id']);
    await queryInterface.addIndex('questions', ['is_active']);
    await queryInterface.addIndex('questions', ['difficulty']);
    await queryInterface.addIndex('questions', ['subject']);
    await queryInterface.addIndex('questions', ['display_order']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('questions');
  }
};