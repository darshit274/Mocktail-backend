'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pdfs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'pdf_categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      file_path: {
        type: Sequelize.STRING,
        allowNull: false
      },
      original_filename: {
        type: Sequelize.STRING,
        allowNull: false
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      mime_type: {
        type: Sequelize.STRING,
        defaultValue: 'application/pdf'
      },
      access_level: {
        type: Sequelize.ENUM('free', 'premium', 'restricted'),
        defaultValue: 'free'
      },
      test_series_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'new_test_series',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      exam_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'exam_types',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true
      },
      download_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      view_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      uploaded_by: {
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
    await queryInterface.addIndex('pdfs', ['category_id']);
    await queryInterface.addIndex('pdfs', ['is_active']);
    await queryInterface.addIndex('pdfs', ['is_featured']);
    await queryInterface.addIndex('pdfs', ['access_level']);
    await queryInterface.addIndex('pdfs', ['test_series_id']);
    await queryInterface.addIndex('pdfs', ['exam_type_id']);
    await queryInterface.addIndex('pdfs', ['uploaded_by']);
    await queryInterface.addIndex('pdfs', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pdfs');
  }
};