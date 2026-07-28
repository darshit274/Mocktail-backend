const { TestSeries, DynamicCategory, DynamicQuestion, sequelize } = require('../models');
const { Op } = require('sequelize');

class DynamicTestManagementController {
  
  // =====================
  // HIERARCHY OVERVIEW
  // =====================
  
  async getTestSeriesHierarchy(req, res) {
    try {
      const { testSeriesId } = req.params;
      const { includeQuestions = false } = req.query;

      // Get the test series
      const testSeries = await TestSeries.findByPk(testSeriesId);
      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test Series not found'
        });
      }

      // Get the complete hierarchy tree
      const hierarchyTree = await DynamicCategory.getHierarchyTree(
        testSeriesId, 
        includeQuestions === 'true'
      );

      // Get statistics
      const stats = await this.getHierarchyStatistics(testSeriesId);

      res.json({
        success: true,
        data: {
          testSeries: {
            id: testSeries.id,
            uuid: testSeries.uuid,
            name: testSeries.name,
            description: testSeries.description
          },
          hierarchy: hierarchyTree,
          statistics: stats
        }
      });

    } catch (error) {
      console.error('Error fetching test series hierarchy:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch hierarchy',
        error: error.message
      });
    }
  }

  // =====================
  // CATEGORY MANAGEMENT
  // =====================

  async createCategory(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        testSeriesId,
        parentCategoryId,
        name,
        name_gujarati,
        description,
        description_gujarati,
        duration_minutes,
        difficulty_level,
        negative_marking_enabled,
        negative_marks_per_wrong,
        is_free_in_paid_series,
        instructions,
        instructions_gujarati
      } = req.body;

      // Validate test series exists
      const testSeries = await TestSeries.findByPk(testSeriesId);
      if (!testSeries) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Test Series not found'
        });
      }

      // If parent category specified, validate it can have subcategories
      if (parentCategoryId) {
        try {
          await DynamicCategory.validateHierarchyRule(parentCategoryId, 'add_subcategory');
        } catch (error) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: error.message
          });
        }
      }

      // Create the category
      const category = await DynamicCategory.create({
        test_series_id: testSeriesId,
        parent_category_id: parentCategoryId || null,
        name,
        name_gujarati,
        description,
        description_gujarati,
        duration_minutes,
        difficulty_level: difficulty_level || 'medium',
        negative_marking_enabled: negative_marking_enabled || false,
        negative_marks_per_wrong: negative_marks_per_wrong || 0.25,
        is_free_in_paid_series: is_free_in_paid_series || false,
        instructions,
        instructions_gujarati
      }, { transaction });

      await transaction.commit();

      // Fetch the created category with associations
      const createdCategory = await DynamicCategory.findByPk(category.id, {
        include: [{
          model: DynamicCategory,
          as: 'parentCategory',
          attributes: ['id', 'uuid', 'name', 'hierarchy_level']
        }]
      });

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: createdCategory
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Error creating category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create category',
        error: error.message
      });
    }
  }

  async getCategoryDetails(req, res) {
    try {
      const { categoryId } = req.params;
      const { includeChildren = true } = req.query;

      const includeOptions = [
        {
          model: DynamicCategory,
          as: 'parentCategory',
          attributes: ['id', 'uuid', 'name', 'hierarchy_level']
        }
      ];

      if (includeChildren === 'true') {
        includeOptions.push({
          model: DynamicCategory,
          as: 'subcategories',
          order: [['display_order', 'ASC']]
        });

        // Include questions if this is a question holder
        includeOptions.push({
          model: DynamicQuestion,
          as: 'questions',
          order: [['display_order', 'ASC']]
        });
      }

      const category = await DynamicCategory.findByPk(categoryId, {
        include: includeOptions
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Add breadcrumb trail
      const breadcrumb = await this.getCategoryBreadcrumb(categoryId);

      // Add available actions based on current state
      const availableActions = this.getAvailableActions(category);

      res.json({
        success: true,
        data: {
          category,
          breadcrumb,
          availableActions
        }
      });

    } catch (error) {
      console.error('Error fetching category details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch category details',
        error: error.message
      });
    }
  }

  async updateCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const updateData = req.body;

      const category = await DynamicCategory.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      await category.update(updateData);

      res.json({
        success: true,
        message: 'Category updated successfully',
        data: category
      });

    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update category',
        error: error.message
      });
    }
  }

  async deleteCategory(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { categoryId } = req.params;

      const category = await DynamicCategory.findByPk(categoryId, {
        include: [
          { model: DynamicCategory, as: 'subcategories' },
          { model: DynamicQuestion, as: 'questions' }
        ]
      });

      if (!category) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Check if category has children or questions
      if (category.subcategories && category.subcategories.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Cannot delete category that has subcategories. Delete subcategories first.'
        });
      }

      if (category.questions && category.questions.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Cannot delete category that has questions. Delete questions first.'
        });
      }

      await category.destroy({ transaction });
      await transaction.commit();

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Error deleting category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete category',
        error: error.message
      });
    }
  }

  // =====================
  // QUESTION MANAGEMENT
  // =====================

  async addQuestion(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { categoryId } = req.params;
      const questionData = req.body;

      // Validate category can have questions
      try {
        await DynamicQuestion.validateCanAddToCategory(categoryId);
      } catch (error) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      // Create the question
      const question = await DynamicQuestion.create({
        category_id: categoryId,
        ...questionData
      }, { transaction });

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: 'Question added successfully',
        data: question
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Error adding question:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add question',
        error: error.message
      });
    }
  }

  async getQuestions(req, res) {
    try {
      const { categoryId } = req.params;
      const { language = 'english' } = req.query;

      // Validate category exists and is a question holder (include TestSeries for UUID)
      const category = await DynamicCategory.findByPk(categoryId, {
        include: [{
          model: TestSeries,
          as: 'testSeries',
          attributes: ['id', 'uuid', 'name']
        }]
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      if (category.node_type !== 'question_holder') {
        return res.status(400).json({
          success: false,
          message: 'This category does not contain questions'
        });
      }

      const questions = await DynamicQuestion.getFormattedQuestions(categoryId, language);

      const responseData = {
        success: true,
        data: {
          category: {
            id: category.id,
            uuid: category.uuid,
            name: category.name,
            node_type: category.node_type,
            test_series_id: category.test_series_id, // Numeric ID for backward compatibility
            test_series_uuid: category.testSeries?.uuid // ✅ ADD: Test series UUID for leaderboard API
          },
          questions
        }
      };

      // console.log('🔍 [Backend] Returning category data:', {
//         category_uuid: category.uuid,
//         test_series_id: category.test_series_id,
//         test_series_uuid: category.testSeries?.uuid,
//         has_testSeries: !!category.testSeries
//       });

      res.json(responseData);

    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch questions',
        error: error.message
      });
    }
  }

  async updateQuestion(req, res) {
    try {
      const { questionId } = req.params;
      const updateData = req.body;

      const question = await DynamicQuestion.findByPk(questionId);
      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      await question.update(updateData);

      res.json({
        success: true,
        message: 'Question updated successfully',
        data: question
      });

    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update question',
        error: error.message
      });
    }
  }

  async deleteQuestion(req, res) {
    try {
      const { questionId } = req.params;

      const question = await DynamicQuestion.findByPk(questionId);
      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      await question.destroy();

      res.json({
        success: true,
        message: 'Question deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete question',
        error: error.message
      });
    }
  }

  // =====================
  // UTILITY METHODS
  // =====================

  async getCategoryBreadcrumb(categoryId) {
    const breadcrumb = [];
    let currentId = categoryId;

    while (currentId) {
      const category = await DynamicCategory.findByPk(currentId, {
        include: [{
          model: DynamicCategory,
          as: 'parentCategory',
          attributes: ['id']
        }]
      });

      if (category) {
        breadcrumb.unshift({
          id: category.id,
          uuid: category.uuid,
          name: category.name,
          hierarchy_level: category.hierarchy_level
        });
        currentId = category.parent_category_id;
      } else {
        break;
      }
    }

    return breadcrumb;
  }

  getAvailableActions(category) {
    const actions = {
      canAddSubcategory: false,
      canAddQuestions: false,
      canEditCategory: true,
      canDeleteCategory: true
    };

    switch (category.node_type) {
      case 'unset':
        actions.canAddSubcategory = true;
        actions.canAddQuestions = true;
        break;
      case 'container':
        actions.canAddSubcategory = true;
        actions.canAddQuestions = false;
        break;
      case 'question_holder':
        actions.canAddSubcategory = false;
        actions.canAddQuestions = true;
        break;
    }

    // Can't delete if has children or questions
    if (category.subcategories?.length > 0 || category.questions?.length > 0) {
      actions.canDeleteCategory = false;
    }

    return actions;
  }

  async getHierarchyStatistics(testSeriesId) {
    const totalCategories = await DynamicCategory.count({
      where: { test_series_id: testSeriesId }
    });

    const containerCategories = await DynamicCategory.count({
      where: { 
        test_series_id: testSeriesId,
        node_type: 'container'
      }
    });

    const questionHolderCategories = await DynamicCategory.count({
      where: { 
        test_series_id: testSeriesId,
        node_type: 'question_holder'
      }
    });

    const totalQuestions = await DynamicQuestion.count({
      include: [{
        model: DynamicCategory,
        as: 'category',
        where: { test_series_id: testSeriesId }
      }]
    });

    return {
      totalCategories,
      containerCategories,
      questionHolderCategories,
      unsetCategories: totalCategories - containerCategories - questionHolderCategories,
      totalQuestions
    };
  }
}

module.exports = new DynamicTestManagementController();