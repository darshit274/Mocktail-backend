'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if columns exist before adding them
    const tableDescription = await queryInterface.describeTable('users');
    
    // Add otp column if it doesn't exist
    if (!tableDescription.otp) {
      await queryInterface.addColumn('users', 'otp', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }
    
    // Add phone column if it doesn't exist
    if (!tableDescription.phone) {
      await queryInterface.addColumn('users', 'phone', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'otp');
    await queryInterface.removeColumn('users', 'phone');
  }
};