'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('hierarchy_categories', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        unique: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      name_gujarati: {
        type: Sequelize.STRING(400),
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
      
      // Hierarchy management
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
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'hierarchy_categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      hierarchy_level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 4
        }
      },
      hierarchy_path: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      
      // Display and organization
      display_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      icon_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      color_code: {
        type: Sequelize.STRING(7),
        allowNull: true
      },
      
      // SEO and metadata
      slug: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSON
      },
      metadata: {
        type: Sequelize.JSON
      },
      
      // Content configuration
      instructions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      instructions_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      
      // Status and visibility
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      
      // Analytics (auto-calculated)
      child_categories_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      tests_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_questions: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      
      // Admin tracking
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL'
      },
      
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      }
    });

    // Add indexes
    await queryInterface.addIndex('hierarchy_categories', ['uuid'], {
      unique: true,
      name: 'hierarchy_categories_uuid_unique'
    });

    await queryInterface.addIndex('hierarchy_categories', ['test_series_id', 'hierarchy_level'], {
      name: 'hierarchy_categories_series_level_index'
    });

    await queryInterface.addIndex('hierarchy_categories', ['parent_id'], {
      name: 'hierarchy_categories_parent_index'
    });

    await queryInterface.addIndex('hierarchy_categories', ['hierarchy_path'], {
      name: 'hierarchy_categories_path_index'
    });

    await queryInterface.addIndex('hierarchy_categories', ['slug'], {
      unique: true,
      name: 'hierarchy_categories_slug_unique'
    });

    await queryInterface.addIndex('hierarchy_categories', ['is_active'], {
      name: 'hierarchy_categories_active_index'
    });

    await queryInterface.addIndex('hierarchy_categories', ['display_order'], {
      name: 'hierarchy_categories_display_order_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('hierarchy_categories');
  }
};