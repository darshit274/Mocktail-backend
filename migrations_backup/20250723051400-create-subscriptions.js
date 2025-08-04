'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('subscription', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
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
        type: Sequelize.UUID,
        allowNull: false
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
    await queryInterface.addIndex('subscription', ['status']);
    await queryInterface.addIndex('subscription', ['transaction_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subscription');
  }
};