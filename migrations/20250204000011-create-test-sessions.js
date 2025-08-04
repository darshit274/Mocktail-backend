'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('test_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'uuid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      started_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_submitted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      remaining_time_seconds: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      current_question_index: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_questions: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      session_data: {
        type: Sequelize.JSON,
        allowNull: true
      },
      answers_data: {
        type: Sequelize.JSON,
        allowNull: true
      },
      calculated_score: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      total_correct: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_wrong: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_unanswered: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_marked_for_review: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('active', 'paused', 'completed', 'expired', 'cancelled'),
        defaultValue: 'active'
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
    await queryInterface.addIndex('test_sessions', ['user_id']);
    await queryInterface.addIndex('test_sessions', ['test_id']);
    await queryInterface.addIndex('test_sessions', ['status']);
    await queryInterface.addIndex('test_sessions', ['is_completed']);
    await queryInterface.addIndex('test_sessions', ['user_id', 'test_id']);
    await queryInterface.addIndex('test_sessions', ['started_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('test_sessions');
  }
};