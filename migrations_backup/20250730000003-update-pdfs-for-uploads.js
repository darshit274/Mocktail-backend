'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the old pdfs table if it exists and create new one
    await queryInterface.dropTable('pdfs').catch(() => {
      // Table might not exist, ignore error
    });

    // Create new uploads-ready PDFs table
    await queryInterface.createTable('pdfs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Display title for the PDF'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      
      // Category relationship
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'pdf_categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      
      // File information
      file_path: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Server path to the PDF file'
      },
      original_filename: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Original filename when uploaded'
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'File size in bytes'
      },
      mime_type: {
        type: Sequelize.STRING,
        defaultValue: 'application/pdf',
        comment: 'MIME type of the file'
      },
      
      // Access control
      access_level: {
        type: Sequelize.ENUM('free', 'premium', 'restricted'),
        defaultValue: 'free',
        comment: 'Who can access this PDF'
      },
      
      // Test series linking (optional) - will add foreign key later
      test_series_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Link to specific test series if applicable'
      },
      
      // Subject/exam linking
      exam_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'exam_types',
          key: 'id'
        },
        comment: 'Link to exam type if applicable'
      },
      
      // Metadata
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of tags for better search'
      },
      download_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of times downloaded'
      },
      view_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of times viewed'
      },
      
      // Status
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      
      // Admin information - will add foreign key later
      uploaded_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Admin who uploaded this PDF'
      },
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('pdfs', ['category_id']);
    await queryInterface.addIndex('pdfs', ['test_series_id']);
    await queryInterface.addIndex('pdfs', ['exam_type_id']);
    await queryInterface.addIndex('pdfs', ['access_level']);
    await queryInterface.addIndex('pdfs', ['is_active']);
    await queryInterface.addIndex('pdfs', ['is_featured']);
    await queryInterface.addIndex('pdfs', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pdfs');
  }
};