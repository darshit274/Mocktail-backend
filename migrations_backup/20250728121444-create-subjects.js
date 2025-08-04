'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('subjects', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Subject name (e.g., Mathematics, English, etc.)'
      },
      code: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'Short code for subject'
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
    await queryInterface.addIndex('subjects', ['is_active']);
    await queryInterface.addIndex('subjects', ['name']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subjects');
  }
};