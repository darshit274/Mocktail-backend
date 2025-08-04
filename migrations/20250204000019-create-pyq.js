'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pyq', {
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
      exam_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING,
        allowNull: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      title_gujarati: {
        type: Sequelize.STRING,
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
      file_url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      thumbnail_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      pages: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      language: {
        type: Sequelize.ENUM('english', 'gujarati', 'both'),
        defaultValue: 'english'
      },
      difficulty_level: {
        type: Sequelize.ENUM('easy', 'medium', 'hard'),
        defaultValue: 'medium'
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true
      },
      solutions_available: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      solutions_file_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      is_premium: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      downloads_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      views_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      rating: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0.00
      },
      rating_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      display_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      meta_data: {
        type: Sequelize.JSON,
        allowNull: true
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
    await queryInterface.addIndex('pyq', ['uuid']);
    await queryInterface.addIndex('pyq', ['exam_type']);
    await queryInterface.addIndex('pyq', ['year']);
    await queryInterface.addIndex('pyq', ['subject']);
    await queryInterface.addIndex('pyq', ['is_active']);
    await queryInterface.addIndex('pyq', ['is_premium']);
    await queryInterface.addIndex('pyq', ['is_featured']);
    await queryInterface.addIndex('pyq', ['difficulty_level']);
    await queryInterface.addIndex('pyq', ['language']);
    await queryInterface.addIndex('pyq', ['solutions_available']);
    await queryInterface.addIndex('pyq', ['created_by']);
    await queryInterface.addIndex('pyq', ['display_order']);
    await queryInterface.addIndex('pyq', ['exam_type', 'year']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pyq');
  }
};