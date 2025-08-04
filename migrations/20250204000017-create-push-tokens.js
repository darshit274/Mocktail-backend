'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('push_tokens', {
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
      token: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      platform: {
        type: Sequelize.ENUM('android', 'ios', 'web'),
        allowNull: false
      },
      device_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      device_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      app_version: {
        type: Sequelize.STRING,
        allowNull: true
      },
      os_version: {
        type: Sequelize.STRING,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      last_used_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
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
    await queryInterface.addIndex('push_tokens', ['uuid']);
    await queryInterface.addIndex('push_tokens', ['user_id']);
    await queryInterface.addIndex('push_tokens', ['platform']);
    await queryInterface.addIndex('push_tokens', ['device_id']);
    await queryInterface.addIndex('push_tokens', ['is_active']);
    await queryInterface.addIndex('push_tokens', ['last_used_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('push_tokens');
  }
};