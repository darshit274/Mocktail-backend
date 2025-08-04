'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add fields to test_series table (check if column exists first)
      const testSeriesTableInfo = await queryInterface.describeTable('test_series');
      
      if (!testSeriesTableInfo.is_free) {
        await queryInterface.addColumn('test_series', 'is_free', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false,
          comment: 'Whether the test series is free or paid'
        }, { transaction });
      }

      await queryInterface.addColumn('test_series', 'free_tests_count', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Number of free tests in paid series'
      }, { transaction });

      await queryInterface.addColumn('test_series', 'requires_subscription', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether series requires subscription to access'
      }, { transaction });

      await queryInterface.addColumn('test_series', 'negative_marking_enabled', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether negative marking is enabled for this series'
      }, { transaction });

      await queryInterface.addColumn('test_series', 'negative_marking_value', {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0.25,
        allowNull: true,
        comment: 'Negative marking value (e.g., 0.25, 0.20, 0.33)'
      }, { transaction });

      await queryInterface.addColumn('test_series', 'one_time_completion', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether tests can be taken only once'
      }, { transaction });

      await queryInterface.addColumn('test_series', 'max_attempts', {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
        comment: 'Maximum attempts allowed per test'
      }, { transaction });

      await queryInterface.addColumn('test_series', 'auto_submit_on_expire', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Auto submit test when time expires'
      }, { transaction });

      // Add fields to tests table
      await queryInterface.addColumn('tests', 'is_free_in_series', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this test is free in a paid series'
      }, { transaction });

      await queryInterface.addColumn('tests', 'negative_marking', {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: null,
        allowNull: true,
        comment: 'Negative marking for this specific test (overrides series setting)'
      }, { transaction });

      await queryInterface.addColumn('tests', 'time_duration_minutes', {
        type: Sequelize.INTEGER,
        defaultValue: 60,
        allowNull: false,
        comment: 'Test duration in minutes'
      }, { transaction });

      await queryInterface.addColumn('tests', 'max_attempts_override', {
        type: Sequelize.INTEGER,
        defaultValue: null,
        allowNull: true,
        comment: 'Override max attempts for this specific test'
      }, { transaction });

      await queryInterface.addColumn('tests', 'difficulty_level', {
        type: Sequelize.ENUM('easy', 'medium', 'hard'),
        defaultValue: 'medium',
        allowNull: false,
        comment: 'Difficulty level of the test'
      }, { transaction });

      await queryInterface.addColumn('tests', 'randomize_questions', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether to randomize question order'
      }, { transaction });

      await queryInterface.addColumn('tests', 'show_results_immediately', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether to show results immediately after test completion'
      }, { transaction });

      await queryInterface.addColumn('tests', 'pass_percentage', {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 60.00,
        allowNull: false,
        comment: 'Minimum percentage required to pass'
      }, { transaction });

      await queryInterface.addColumn('tests', 'allow_review', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether students can review answers after test'
      }, { transaction });

      // Add fields to questions table for better categorization
      await queryInterface.addColumn('questions', 'subject_tag', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Subject tag for the question (e.g., Mathematics, Physics)'
      }, { transaction });

      await queryInterface.addColumn('questions', 'topic_tag', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Topic tag for the question (e.g., Algebra, Geometry)'
      }, { transaction });

      await queryInterface.addColumn('questions', 'difficulty_tag', {
        type: Sequelize.ENUM('easy', 'medium', 'hard'),
        defaultValue: 'medium',
        allowNull: false,
        comment: 'Difficulty level of the question'
      }, { transaction });

      await queryInterface.addColumn('questions', 'time_to_solve_seconds', {
        type: Sequelize.INTEGER,
        defaultValue: 120,
        allowNull: false,
        comment: 'Expected time to solve this question in seconds'
      }, { transaction });

      await queryInterface.addColumn('questions', 'question_type', {
        type: Sequelize.ENUM('single_choice', 'multiple_choice', 'true_false', 'fill_blank'),
        defaultValue: 'single_choice',
        allowNull: false,
        comment: 'Type of question'
      }, { transaction });

      // Add indexes for better performance
      await queryInterface.addIndex('test_series', ['is_free'], { transaction });
      await queryInterface.addIndex('test_series', ['requires_subscription'], { transaction });
      await queryInterface.addIndex('tests', ['is_free_in_series'], { transaction });
      await queryInterface.addIndex('tests', ['difficulty_level'], { transaction });
      await queryInterface.addIndex('questions', ['subject_tag'], { transaction });
      await queryInterface.addIndex('questions', ['difficulty_tag'], { transaction });

      await transaction.commit();
      console.log('✅ Advanced test features migration completed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove indexes
      await queryInterface.removeIndex('test_series', ['is_free'], { transaction });
      await queryInterface.removeIndex('test_series', ['requires_subscription'], { transaction });
      await queryInterface.removeIndex('tests', ['is_free_in_series'], { transaction });
      await queryInterface.removeIndex('tests', ['difficulty_level'], { transaction });
      await queryInterface.removeIndex('questions', ['subject_tag'], { transaction });
      await queryInterface.removeIndex('questions', ['difficulty_tag'], { transaction });

      // Remove columns from test_series
      await queryInterface.removeColumn('test_series', 'is_free', { transaction });
      await queryInterface.removeColumn('test_series', 'free_tests_count', { transaction });
      await queryInterface.removeColumn('test_series', 'requires_subscription', { transaction });
      await queryInterface.removeColumn('test_series', 'negative_marking_enabled', { transaction });
      await queryInterface.removeColumn('test_series', 'negative_marking_value', { transaction });
      await queryInterface.removeColumn('test_series', 'one_time_completion', { transaction });
      await queryInterface.removeColumn('test_series', 'max_attempts', { transaction });
      await queryInterface.removeColumn('test_series', 'auto_submit_on_expire', { transaction });

      // Remove columns from tests
      await queryInterface.removeColumn('tests', 'is_free_in_series', { transaction });
      await queryInterface.removeColumn('tests', 'negative_marking', { transaction });
      await queryInterface.removeColumn('tests', 'time_duration_minutes', { transaction });
      await queryInterface.removeColumn('tests', 'max_attempts_override', { transaction });
      await queryInterface.removeColumn('tests', 'difficulty_level', { transaction });
      await queryInterface.removeColumn('tests', 'randomize_questions', { transaction });
      await queryInterface.removeColumn('tests', 'show_results_immediately', { transaction });
      await queryInterface.removeColumn('tests', 'pass_percentage', { transaction });
      await queryInterface.removeColumn('tests', 'allow_review', { transaction });

      // Remove columns from questions
      await queryInterface.removeColumn('questions', 'subject_tag', { transaction });
      await queryInterface.removeColumn('questions', 'topic_tag', { transaction });
      await queryInterface.removeColumn('questions', 'difficulty_tag', { transaction });
      await queryInterface.removeColumn('questions', 'time_to_solve_seconds', { transaction });
      await queryInterface.removeColumn('questions', 'question_type', { transaction });

      await transaction.commit();
      console.log('✅ Advanced test features migration rollback completed');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration rollback failed:', error);
      throw error;
    }
  }
};