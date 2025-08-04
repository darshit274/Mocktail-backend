'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('users');
    
    // Add isEmailVerified column if it doesn't exist
    if (!tableDescription.isEmailVerified) {
      await queryInterface.addColumn('users', 'isEmailVerified', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }

    // Add otpExpiry column if it doesn't exist
    if (!tableDescription.otpExpiry) {
      await queryInterface.addColumn('users', 'otpExpiry', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    // Add lastLogin column if it doesn't exist
    if (!tableDescription.lastLogin) {
      await queryInterface.addColumn('users', 'lastLogin', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    // Add isActive column if it doesn't exist
    if (!tableDescription.isActive) {
      await queryInterface.addColumn('users', 'isActive', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      });
    }

    // Add subscription_status column if it doesn't exist
    if (!tableDescription.subscription_status) {
      await queryInterface.addColumn('users', 'subscription_status', {
        type: Sequelize.ENUM('none', 'active', 'expired'),
        defaultValue: 'none',
        allowNull: false
      });
    }

    // Add total_subscriptions column if it doesn't exist
    if (!tableDescription.total_subscriptions) {
      await queryInterface.addColumn('users', 'total_subscriptions', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      });
    }

    // Add subscription_expiry_reminder_sent column if it doesn't exist
    if (!tableDescription.subscription_expiry_reminder_sent) {
      await queryInterface.addColumn('users', 'subscription_expiry_reminder_sent', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'isEmailVerified');
    await queryInterface.removeColumn('users', 'otpExpiry');
    await queryInterface.removeColumn('users', 'lastLogin');
    await queryInterface.removeColumn('users', 'isActive');
    await queryInterface.removeColumn('users', 'subscription_status');
    await queryInterface.removeColumn('users', 'total_subscriptions');
    await queryInterface.removeColumn('users', 'subscription_expiry_reminder_sent');
  }
};