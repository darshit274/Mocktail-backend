'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('subject_hierarchies', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Hierarchy level name (e.g., Class 6, Chapter 1, etc.)'
      },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'subject_hierarchies',
          key: 'id'
        }
      },
      subject_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'subjects',
          key: 'id'
        }
      },
      level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Hierarchy level (1 = Class, 2 = Chapter, 3 = Topic, etc.)'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('subject_hierarchies', ['parent_id']);
    await queryInterface.addIndex('subject_hierarchies', ['subject_id']);
    await queryInterface.addIndex('subject_hierarchies', ['is_active']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subject_hierarchies');
  }
};