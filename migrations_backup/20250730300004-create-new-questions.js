'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('new_questions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      
      // Associations
      test_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'new_tests',
          key: 'id'
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
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'hierarchy_categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      
      // Question content
      question_text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      question_text_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      question_image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      
      // Question configuration
      question_type: {
        type: Sequelize.ENUM('single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'numerical'),
        defaultValue: 'single_choice'
      },
      difficulty_level: {
        type: Sequelize.ENUM('easy', 'medium', 'hard'),
        defaultValue: 'medium'
      },
      marks: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      negative_marks: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0
      },
      
      // Options and answers (stored as JSON)
      options: {
        type: Sequelize.JSON,
        allowNull: false
      },
      correct_answer: {
        type: Sequelize.JSON,
        allowNull: false
      },
      
      // Explanations
      explanation: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      explanation_gujarati: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      explanation_image_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      
      // Categorization and tagging
      subject: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      topic: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      subtopic: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSON
      },
      
      // Time and difficulty
      estimated_time_seconds: {
        type: Sequelize.INTEGER,
        defaultValue: 60
      },
      
      // Status and ordering
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      display_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      
      // Source and references
      source: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      reference_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      
      // Analytics (auto-calculated)
      total_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      correct_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      accuracy_rate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      average_time_taken: {
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
      last_modified_by: {
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
    await queryInterface.addIndex('new_questions', ['uuid'], {
      unique: true,
      name: 'new_questions_uuid_unique'
    });

    await queryInterface.addIndex('new_questions', ['test_id'], {
      name: 'new_questions_test_index'
    });

    await queryInterface.addIndex('new_questions', ['test_series_id'], {
      name: 'new_questions_series_index'
    });

    await queryInterface.addIndex('new_questions', ['category_id'], {
      name: 'new_questions_category_index'
    });

    await queryInterface.addIndex('new_questions', ['question_type'], {
      name: 'new_questions_type_index'
    });

    await queryInterface.addIndex('new_questions', ['difficulty_level'], {
      name: 'new_questions_difficulty_index'
    });

    await queryInterface.addIndex('new_questions', ['subject'], {
      name: 'new_questions_subject_index'
    });

    await queryInterface.addIndex('new_questions', ['is_active'], {
      name: 'new_questions_active_index'
    });

    await queryInterface.addIndex('new_questions', ['display_order'], {
      name: 'new_questions_display_order_index'
    });

    await queryInterface.addIndex('new_questions', ['test_id', 'display_order'], {
      name: 'new_questions_test_order_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('new_questions');
  }
};