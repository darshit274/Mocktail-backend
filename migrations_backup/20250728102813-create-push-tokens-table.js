'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('push_tokens', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
      push_token: {
        type: Sequelize.STRING(512),
        allowNull: false,
        unique: true
      },
      platform: {
        type: Sequelize.ENUM('ios', 'android'),
        allowNull: false
      },
      device_info: {
        type: Sequelize.JSON,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex('push_tokens', ['user_id']);
    await queryInterface.addIndex('push_tokens', ['push_token'], { unique: true });
    await queryInterface.addIndex('push_tokens', ['is_active']);
    await queryInterface.addIndex('push_tokens', ['expires_at']);
    await queryInterface.addIndex('push_tokens', ['user_id', 'is_active']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('push_tokens');
  }
};
