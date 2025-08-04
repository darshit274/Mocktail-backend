'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add multilingual fields to exam_categories table if they don't exist
      const categoryTableInfo = await queryInterface.describeTable('exam_categories');
      
      if (!categoryTableInfo.name_gujarati) {
        await queryInterface.addColumn('exam_categories', 'name_gujarati', {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'Category name in Gujarati'
        }, { transaction });
      }

      if (!categoryTableInfo.description_gujarati) {
        await queryInterface.addColumn('exam_categories', 'description_gujarati', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Category description in Gujarati'
        }, { transaction });
      }

      // Check if we have a categories table and add multilingual fields
      const tablesResult = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'categories'",
        { transaction }
      );
      
      if (tablesResult[0].length > 0) {
        const categoriesTableInfo = await queryInterface.describeTable('categories');
        
        if (!categoriesTableInfo.name_gujarati) {
          await queryInterface.addColumn('categories', 'name_gujarati', {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'Category name in Gujarati'
          }, { transaction });
        }

        if (!categoriesTableInfo.description_gujarati) {
          await queryInterface.addColumn('categories', 'description_gujarati', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Category description in Gujarati'
          }, { transaction });
        }
      }

      // Check if we have a sub_categories table and add multilingual fields
      const subCategoriesResult = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'sub_categories'",
        { transaction }
      );
      
      if (subCategoriesResult[0].length > 0) {
        const subCategoriesTableInfo = await queryInterface.describeTable('sub_categories');
        
        if (!subCategoriesTableInfo.name_gujarati) {
          await queryInterface.addColumn('sub_categories', 'name_gujarati', {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'Sub-category name in Gujarati'
          }, { transaction });
        }

        if (!subCategoriesTableInfo.description_gujarati) {
          await queryInterface.addColumn('sub_categories', 'description_gujarati', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Sub-category description in Gujarati'
          }, { transaction });
        }
      }

      // Add additional fields to tests table for better management
      const testsTableInfo = await queryInterface.describeTable('tests');
      
      if (!testsTableInfo.instructions) {
        await queryInterface.addColumn('tests', 'instructions', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Test instructions in English'
        }, { transaction });
      }

      if (!testsTableInfo.instructions_gujarati) {
        await queryInterface.addColumn('tests', 'instructions_gujarati', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Test instructions in Gujarati'
        }, { transaction });
      }

      if (!testsTableInfo.total_marks) {
        await queryInterface.addColumn('tests', 'total_marks', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: 'Total marks for the test'
        }, { transaction });
      }

      if (!testsTableInfo.total_questions) {
        await queryInterface.addColumn('tests', 'total_questions', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: 'Total number of questions in the test'
        }, { transaction });
      }

      // Add sorting and display order fields
      if (!testsTableInfo.display_order) {
        await queryInterface.addColumn('tests', 'display_order', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: 'Display order for sorting tests'
        }, { transaction });
      }

      // Add fields to questions table for better management
      const questionsTableInfo = await queryInterface.describeTable('questions');
      
      if (!questionsTableInfo.marks) {
        await queryInterface.addColumn('questions', 'marks', {
          type: Sequelize.INTEGER,
          defaultValue: 1,
          allowNull: false,
          comment: 'Marks for this question'
        }, { transaction });
      }

      if (!questionsTableInfo.negative_marks) {
        await queryInterface.addColumn('questions', 'negative_marks', {
          type: Sequelize.DECIMAL(3, 2),
          defaultValue: null,
          allowNull: true,
          comment: 'Negative marks for wrong answer'
        }, { transaction });
      }

      if (!questionsTableInfo.display_order) {
        await queryInterface.addColumn('questions', 'display_order', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: 'Display order for sorting questions'
        }, { transaction });
      }

      // Add indexes for better performance
      await queryInterface.addIndex('tests', ['display_order'], { transaction });
      await queryInterface.addIndex('questions', ['display_order'], { transaction });
      await queryInterface.addIndex('questions', ['marks'], { transaction });

      await transaction.commit();
      console.log('✅ Multilingual category fields migration completed successfully');
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
      await queryInterface.removeIndex('tests', ['display_order'], { transaction });
      await queryInterface.removeIndex('questions', ['display_order'], { transaction });
      await queryInterface.removeIndex('questions', ['marks'], { transaction });

      // Remove columns from exam_categories
      await queryInterface.removeColumn('exam_categories', 'name_gujarati', { transaction });
      await queryInterface.removeColumn('exam_categories', 'description_gujarati', { transaction });

      // Remove columns from categories if table exists
      const tablesResult = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'categories'",
        { transaction }
      );
      
      if (tablesResult[0].length > 0) {
        await queryInterface.removeColumn('categories', 'name_gujarati', { transaction });
        await queryInterface.removeColumn('categories', 'description_gujarati', { transaction });
      }

      // Remove columns from sub_categories if table exists
      const subCategoriesResult = await queryInterface.sequelize.query(
        "SHOW TABLES LIKE 'sub_categories'",
        { transaction }
      );
      
      if (subCategoriesResult[0].length > 0) {
        await queryInterface.removeColumn('sub_categories', 'name_gujarati', { transaction });
        await queryInterface.removeColumn('sub_categories', 'description_gujarati', { transaction });
      }

      // Remove columns from tests
      await queryInterface.removeColumn('tests', 'instructions', { transaction });
      await queryInterface.removeColumn('tests', 'instructions_gujarati', { transaction });
      await queryInterface.removeColumn('tests', 'total_marks', { transaction });
      await queryInterface.removeColumn('tests', 'total_questions', { transaction });
      await queryInterface.removeColumn('tests', 'display_order', { transaction });

      // Remove columns from questions
      await queryInterface.removeColumn('questions', 'marks', { transaction });
      await queryInterface.removeColumn('questions', 'negative_marks', { transaction });
      await queryInterface.removeColumn('questions', 'display_order', { transaction });

      await transaction.commit();
      console.log('✅ Multilingual category fields migration rollback completed');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration rollback failed:', error);
      throw error;
    }
  }
};