'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('exam_categories', {
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
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      name_gujarati: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      hierarchy_level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'exam_categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      hierarchy_path: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      display_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
    await queryInterface.addIndex('exam_categories', ['uuid']);
    await queryInterface.addIndex('exam_categories', ['parent_id']);
    await queryInterface.addIndex('exam_categories', ['hierarchy_level']);
    await queryInterface.addIndex('exam_categories', ['is_active']);
    await queryInterface.addIndex('exam_categories', ['display_order']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('exam_categories');
  }
};