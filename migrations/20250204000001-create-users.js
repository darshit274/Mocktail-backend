'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      profileImage: {
        type: Sequelize.STRING,
        allowNull: true
      },
      otp: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      otpExpiry: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isEmailVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lastLogin: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      subscription_status: {
        type: Sequelize.ENUM('none', 'active', 'expired'),
        defaultValue: 'none',
        allowNull: false
      },
      total_subscriptions: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      subscription_expiry_reminder_sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['username']);
    await queryInterface.addIndex('users', ['subscription_status']);
    await queryInterface.addIndex('users', ['isActive']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  }
};