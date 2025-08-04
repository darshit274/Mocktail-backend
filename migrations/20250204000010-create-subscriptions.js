'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
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
      test_series_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'new_test_series',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      payment_method: {
        type: Sequelize.STRING,
        allowNull: true
      },
      amount_paid: {
        type: Sequelize.DOUBLE,
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: 'INR'
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
        defaultValue: 'pending'
      },
      purchase_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      expiry_date: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex('subscription', ['user_id']);
    await queryInterface.addIndex('subscription', ['test_series_id']);
    await queryInterface.addIndex('subscription', ['transaction_id']);
    await queryInterface.addIndex('subscription', ['status']);
    await queryInterface.addIndex('subscription', ['expiry_date']);
    await queryInterface.addIndex('subscription', ['user_id', 'test_series_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscription');
  }
};