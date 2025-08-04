'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('questions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      question_text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      option_a: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      option_b: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      option_c: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      option_d: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      correct_answer: {
        type: Sequelize.ENUM('A', 'B', 'C', 'D'),
        allowNull: false
      },
      explanation: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      marks: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('questions');
  }
};