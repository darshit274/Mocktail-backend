'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_access_logs', {
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
      subscription_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'subscription',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      resource_type: {
        type: Sequelize.ENUM('test', 'pdf', 'video', 'content'),
        allowNull: false
      },
      resource_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      action: {
        type: Sequelize.ENUM('access', 'download', 'view', 'attempt'),
        allowNull: false
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      device_info: {
        type: Sequelize.JSON,
        allowNull: true
      },
      session_duration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      additional_data: {
        type: Sequelize.JSON,
        allowNull: true
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
    await queryInterface.addIndex('subscription_access_logs', ['uuid']);
    await queryInterface.addIndex('subscription_access_logs', ['user_id']);
    await queryInterface.addIndex('subscription_access_logs', ['subscription_id']);
    await queryInterface.addIndex('subscription_access_logs', ['resource_type']);
    await queryInterface.addIndex('subscription_access_logs', ['resource_id']);
    await queryInterface.addIndex('subscription_access_logs', ['action']);
    await queryInterface.addIndex('subscription_access_logs', ['created_at']);
    await queryInterface.addIndex('subscription_access_logs', ['user_id', 'resource_type', 'resource_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscription_access_logs');
  }
};