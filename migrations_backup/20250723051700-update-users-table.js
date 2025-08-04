'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns to users table
    await queryInterface.addColumn('users', 'lastLogin', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    await queryInterface.addColumn('users', 'isActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    // Add indexes
    await queryInterface.addIndex('users', ['isActive']);
    await queryInterface.addIndex('users', ['lastLogin']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'lastLogin');
    await queryInterface.removeColumn('users', 'isActive');
  }
};