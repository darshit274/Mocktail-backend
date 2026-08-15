const { TestSeries, Category, SubCategory, Test, Question } = require('../models');
const { Op } = require('sequelize');

// Helper functions for hierarchy transformation
function transformToHierarchy(testSeries) {
  const hierarchy = [];

  testSeries.categories?.forEach(category => {
    const categoryNode = {
      id: category.id,
      uuid: category.uuid,
      name: category.name,
      description: category.description,
      hierarchy_level: 0,
      node_type: category.subCategories?.length > 0 ? 'container' : 'unset',
      has_questions: false,
      has_subcategories: category.subCategories?.length > 0,
      questions_count: 0,
      subcategories_count: category.subCategories?.length || 0,
      total_questions_count: getTotalQuestions(category),
      display_order: 0,
      is_active: category.is_active,
      children: []
    };

    // Add subcategories
    category.subCategories?.forEach(subCategory => {
      const subCategoryNode = {
        id: subCategory.id,
        uuid: subCategory.uuid,
        name: subCategory.name,
        description: subCategory.description,
        hierarchy_level: 1,
        node_type: subCategory.tests?.length > 0 ? 'question_holder' : 'unset',
        has_questions: subCategory.tests?.some(test => test.questions?.length > 0) || false,
        has_subcategories: false,
        questions_count: getSubCategoryQuestionCount(subCategory),
        subcategories_count: 0,
        total_questions_count: getSubCategoryQuestionCount(subCategory),
        display_order: 0,
        is_active: subCategory.is_active,
        tests: subCategory.tests || []
      };

      categoryNode.children.push(subCategoryNode);
    });

    hierarchy.push(categoryNode);
  });

  return hierarchy;
}

function getTotalQuestions(category) {
  return category.subCategories?.reduce((acc, sub) =>
    acc + sub.tests?.reduce((testAcc, test) => testAcc + (test.questions?.length || 0), 0), 0) || 0;
}

function getSubCategoryQuestionCount(subCategory) {
  return subCategory.tests?.reduce((acc, test) => acc + (test.questions?.length || 0), 0) || 0;
}

class TestManagementController {
  // =====================
  // DYNAMIC HIERARCHY MANAGEMENT (NEW)
  // =====================

  // Get test series with dynamic hierarchy view
  async getTestSeriesWithHierarchy(req, res) {
    try {
      const { uuid } = req.params;

      // Get test series
      const testSeries = await TestSeries.findOne({
        where: { uuid },
        include: [{
          model: Category,
          as: 'categories',
          include: [{
            model: SubCategory,
            as: 'subCategories',
            include: [{
              model: Test,
              as: 'tests',
              include: [{
                model: Question,
                as: 'questions',
                attributes: ['id', 'uuid', 'question_text', 'marks']
              }]
            }]
          }]
        }]
      });

      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test Series not found'
        });
      }

      // Transform to dynamic hierarchy structure
      const dynamicHierarchy = transformToHierarchy(testSeries);

      res.json({
        success: true,
        data: {
          testSeries: {
            id: testSeries.id,
            uuid: testSeries.uuid,
            name: testSeries.name,
            description: testSeries.description
          },
          hierarchy: dynamicHierarchy,
          statistics: {
            totalCategories: testSeries.categories?.length || 0,
            totalSubCategories: testSeries.categories?.reduce((acc, cat) => acc + (cat.subCategories?.length || 0), 0) || 0,
            totalTests: testSeries.categories?.reduce((acc, cat) =>
              acc + cat.subCategories?.reduce((subAcc, sub) => subAcc + (sub.tests?.length || 0), 0), 0) || 0,
            totalQuestions: testSeries.categories?.reduce((acc, cat) =>
              acc + cat.subCategories?.reduce((subAcc, sub) =>
                subAcc + sub.tests?.reduce((testAcc, test) => testAcc + (test.questions?.length || 0), 0), 0), 0) || 0
          }
        }
      });

    } catch (error) {
      console.error('Error fetching hierarchy:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch hierarchy',
        error: error.message
      });
    }
  }


  // Create new category (can be subcategory or question holder)
  async createDynamicCategory(req, res) {
    try {
      const { testSeriesUuid } = req.params;
      const {
        parentCategoryId,
        name,
        description,
        name_gujarati,
        description_gujarati,
        isQuestionHolder = false
      } = req.body;

      // Find test series
      const testSeries = await TestSeries.findOne({ where: { uuid: testSeriesUuid } });
      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test Series not found'
        });
      }

      let createdCategory;

      if (!parentCategoryId) {
        // Create root category
        createdCategory = await Category.create({
          test_series_id: testSeries.id,
          name,
          description,
          name_gujarati,
          description_gujarati,
          is_active: true
        });
      } else {
        // Create subcategory
        createdCategory = await SubCategory.create({
          category_id: parentCategoryId,
          name,
          description,
          name_gujarati,
          description_gujarati,
          is_active: true
        });
      }

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: {
          ...createdCategory.toJSON(),
          node_type: 'unset',
          hierarchy_level: parentCategoryId ? 1 : 0,
          has_questions: false,
          has_subcategories: false,
          questions_count: 0,
          subcategories_count: 0,
          total_questions_count: 0
        }
      });

    } catch (error) {
      console.error('Error creating dynamic category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create category',
        error: error.message
      });
    }
  }

  // Get available actions for a category
  async getDynamicCategoryActions(req, res) {
    try {
      const { categoryId } = req.params;
      const { type } = req.query; // 'category' or 'subcategory'

      let category;
      if (type === 'subcategory') {
        category = await SubCategory.findByPk(categoryId, {
          include: [{
            model: Test,
            as: 'tests',
            include: [{ model: Question, as: 'questions' }]
          }]
        });
      } else {
        category = await Category.findByPk(categoryId, {
          include: [{
            model: SubCategory,
            as: 'subCategories'
          }]
        });
      }

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const hasSubcategories = type === 'category' && category.subCategories?.length > 0;
      const hasQuestions = type === 'subcategory' && category.tests?.some(test => test.questions?.length > 0);

      const actions = {
        canAddSubcategory: type === 'category' && !hasQuestions,
        canAddQuestions: type === 'subcategory' && !hasSubcategories,
        canEditCategory: true,
        canDeleteCategory: !hasSubcategories && !hasQuestions
      };

      res.json({
        success: true,
        data: {
          categoryId,
          type,
          nodeType: hasSubcategories ? 'container' : hasQuestions ? 'question_holder' : 'unset',
          actions
        }
      });

    } catch (error) {
      console.error('Error getting category actions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get category actions',
        error: error.message
      });
    }
  }

  // =====================
  // TEST SERIES MANAGEMENT
  // =====================

  // Get all test series with pagination, filtering, and statistics
  async getTestSeries(req, res) {
    // console.log('=================================');
    // console.log('🔥 CLAUDE DEBUG: getTestSeries called!');
    // console.log('=================================');
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = 'all',
        sortBy = 'display_order',
        sortOrder = 'ASC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause
      let where = {};
      if (status === 'active') {
        where.is_active = true;
      } else if (status === 'inactive') {
        where.is_active = false;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const allowedSortFields = ['display_order', 'created_at', 'name', 'updated_at'];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'display_order';

      // Get paginated data
      const { count, rows: testSeries } = await TestSeries.findAndCountAll({
        attributes: [
          'id', 'uuid', 'name', 'name_gujarati', 'description', 'description_gujarati', 'is_active', 'created_at', 'updated_at',
          'pricing_type', 'price', 'currency',
          'features', 'discount_percentage', 'is_featured', 'is_course_closed', 'has_negative_marking', 'negative_marks', 'validity_days',
          'display_order'
        ],
        where,
        order: [[safeSortBy, sortOrder]],
        limit: parseInt(limit),
        offset,
        include: [{
          model: Category,
          as: 'categories',
          attributes: ['id'],
          required: false
        }]
      });

      // Get statistics
      const stats = {
        total: await TestSeries.count(),
        active: await TestSeries.count({ where: { is_active: true } }),
        inactive: await TestSeries.count({ where: { is_active: false } }),
        withCategories: await TestSeries.count({
          include: [{
            model: Category,
            as: 'categories',
            required: true
          }]
        })
      };

      // Transform data to match frontend expectations
      // console.log('DEBUG: Raw testSeries data from DB:', JSON.stringify(testSeries.slice(0, 1), null, 2));

      const transformedSeries = testSeries.map(series => {
        // console.log('DEBUG: Processing series:', series.uuid, 'has_negative_marking:', series.has_negative_marking, 'negative_marks:', series.negative_marks, "is_course_closed", series.dataValues.is_course_closed);
        // console.log('DEBUG: Processing series:', series);

        return {
          id: series.id,
          uuid: series.uuid,
          title: series.name, // Map name to title for frontend
          title_gujarati: series.name_gujarati,
          description: series.description,
          description_gujarati: series.description_gujarati,
          is_active: series.is_active,
          pricing_type: series.pricing_type,
          price: series.price,
          currency: series.currency,
          features: series.features,
          discount_percentage: series.discount_percentage,
          is_featured: series.is_featured,
          is_course_closed: series.dataValues.is_course_closed,
          has_negative_marking: series.has_negative_marking,
          negative_marks: series.negative_marks,
          validity_days: series.validity_days,
          created_at: series.created_at,
          updated_at: series.updated_at,
          categories_count: series.categories ? series.categories.length : 0,
          display_order: series.display_order
        };
      });

      // console.log('DEBUG: Transformed response first item:', JSON.stringify(transformedSeries[0], null, 2));

      res.json({
        success: true,
        data: transformedSeries,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        stats
      });
    } catch (error) {
      console.error('Error fetching test series:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch test series'
      });
    }
  }

  // Get single test series by UUID
  async getTestSeriesById(req, res) {
    try {
      const { uuid } = req.params;

      const testSeries = await TestSeries.findOne({
        where: { uuid },
        attributes: [
          'id', 'uuid', 'name', 'name_gujarati', 'description', 'description_gujarati',
          'is_active', 'created_at', 'updated_at', 'pricing_type', 'price', 'currency',
          'features', 'discount_percentage',
          'is_featured', 'difficulty_level', 'free_test_count', 'max_attempts_per_test',
          'has_negative_marking', 'negative_marks', 'supports_pause_resume', 'supports_multilanguage', 'validity_days',
          'is_course_closed'
        ]
      });

      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test series not found'
        });
      }

      res.json({
        success: true,
        data: testSeries
      });
    } catch (error) {
      console.error('Error fetching test series:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch test series'
      });
    }
  }

  // Create new test series
  async createTestSeries(req, res) {
    try {
      const {
        title,
        description,
        title_gujarati,
        description_gujarati,
        is_active,
        pricing_type,
        price,
        currency,
        features,
        discount_percentage,
        is_featured,
        is_free,
        free_tests_count,
        requires_subscription,
        negative_marking_enabled,
        negative_marking_value,
        one_time_completion,
        max_attempts,
        auto_submit_on_expire,
        validity_days,
        is_course_closed
      } = req.body;

      // Auto-assign display_order as max + 1 so new series appears at the end
      const maxOrderResult = await TestSeries.findOne({
        attributes: [[TestSeries.sequelize.fn('MAX', TestSeries.sequelize.col('display_order')), 'maxOrder']],
        raw: true
      });
      const nextDisplayOrder = (maxOrderResult?.maxOrder || 0) + 1;

      const testSeries = await TestSeries.create({
        name: title,
        description,
        name_gujarati: title_gujarati,
        description_gujarati,
        is_active: is_active !== undefined ? is_active : true,
        pricing_type: pricing_type || 'free',
        price: price || 0.00,
        currency: currency || 'INR',
        features: features || [],
        discount_percentage: discount_percentage || 0.00,
        is_featured: is_featured || false,
        difficulty_level: 'beginner',
        free_test_count: free_tests_count || 0,
        max_attempts_per_test: max_attempts || 1,
        supports_pause_resume: true,
        supports_multilanguage: true,
        validity_days: validity_days || 365,
        is_course_closed: is_course_closed || false,
        display_order: nextDisplayOrder
      });

      // Transform response to match frontend expectations
      res.status(201).json({
        success: true,
        data: {
          id: testSeries.id,
          uuid: testSeries.uuid,
          title: testSeries.name,
          title_gujarati: testSeries.name_gujarati,
          description: testSeries.description,
          description_gujarati: testSeries.description_gujarati,
          is_active: testSeries.is_active,
          pricing_type: testSeries.pricing_type,
          price: testSeries.price,
          currency: testSeries.currency,
          features: testSeries.features,
          discount_percentage: testSeries.discount_percentage,
          is_featured: testSeries.is_featured,
          is_free: testSeries.is_free,
          free_tests_count: testSeries.free_tests_count,
          requires_subscription: testSeries.requires_subscription,
          negative_marking_enabled: testSeries.negative_marking_enabled,
          negative_marking_value: testSeries.negative_marking_value,
          one_time_completion: testSeries.one_time_completion,
          max_attempts: testSeries.max_attempts,
          auto_submit_on_expire: testSeries.auto_submit_on_expire,
          validity_days: testSeries.validity_days,
          is_course_closed: testSeries.is_course_closed,
          created_at: testSeries.created_at,
          updated_at: testSeries.updated_at
        },
        message: 'Test series created successfully'
      });
    } catch (error) {
      console.error('Error creating test series:', error);
      console.error('Error stack:', error.stack);
      console.error('Request body:', req.body);

      // More detailed error response
      const errorResponse = {
        success: false,
        message: 'Failed to create test series'
      };

      if (process.env.NODE_ENV === 'development' || true) { // Always show error in dev
        errorResponse.error = error.message;
        errorResponse.details = error.errors ? error.errors.map(e => ({
          field: e.path,
          message: e.message,
          type: e.type
        })) : undefined;
      }

      res.status(500).json(errorResponse);
    }
  }

  // Bulk operations for test series
  async bulkOperationsTestSeries(req, res) {
    try {
      const { action, testSeriesIds } = req.body;

      if (!action || !testSeriesIds || !Array.isArray(testSeriesIds)) {
        return res.status(400).json({
          success: false,
          message: 'Action and testSeriesIds array are required'
        });
      }

      let message = '';
      let updateData = {};

      switch (action) {
        case 'delete':
          await TestSeries.destroy({
            where: { uuid: { [Op.in]: testSeriesIds } }
          });
          message = `${testSeriesIds.length} test series deleted successfully`;
          break;
        case 'activate':
          updateData = { is_active: true };
          await TestSeries.update(updateData, {
            where: { uuid: { [Op.in]: testSeriesIds } }
          });
          message = `${testSeriesIds.length} test series activated successfully`;
          break;
        case 'deactivate':
          updateData = { is_active: false };
          await TestSeries.update(updateData, {
            where: { uuid: { [Op.in]: testSeriesIds } }
          });
          message = `${testSeriesIds.length} test series deactivated successfully`;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action. Supported actions: delete, activate, deactivate'
          });
      }

      res.json({
        success: true,
        message,
        data: { action, count: testSeriesIds.length }
      });
    } catch (error) {
      console.error('Error in bulk operations for test series:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk operations'
      });
    }
  }

  // Update test series
  async updateTestSeries(req, res) {
    try {
      const { uuid } = req.params;
      const {
        title,
        description,
        title_gujarati,
        description_gujarati,
        is_active,
        pricing_type,
        price,
        currency,
        features,
        discount_percentage,
        is_featured,
        validity_days,
        is_course_closed
      } = req.body;

      const testSeries = await TestSeries.findOne({
        where: { uuid }
      });
      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test series not found'
        });
      }

      const updateData = {
        name: title,
        description,
        name_gujarati: title_gujarati,
        description_gujarati,
        is_active,
        is_course_closed
      };

      // Add pricing fields if provided
      if (pricing_type !== undefined) updateData.pricing_type = pricing_type;
      if (price !== undefined) updateData.price = price;
      if (currency !== undefined) updateData.currency = currency;
      if (features !== undefined) updateData.features = features;
      if (discount_percentage !== undefined) updateData.discount_percentage = discount_percentage;
      if (is_featured !== undefined) updateData.is_featured = is_featured;
      if (validity_days !== undefined) updateData.validity_days = validity_days;
      // Negative marking fields removed - now handled at category level

      await testSeries.update(updateData);

      // Return the updated test series with proper field mapping
      const updatedData = {
        id: testSeries.id,
        uuid: testSeries.uuid,
        title: testSeries.name,
        title_gujarati: testSeries.name_gujarati,
        description: testSeries.description,
        description_gujarati: testSeries.description_gujarati,
        is_active: testSeries.is_active,
        is_course_closed: testSeries.is_course_closed,
        pricing_type: testSeries.pricing_type,
        price: testSeries.price,
        currency: testSeries.currency,
        features: testSeries.features,
        discount_percentage: testSeries.discount_percentage,
        is_featured: testSeries.is_featured,
        has_negative_marking: testSeries.has_negative_marking,
        negative_marks: testSeries.negative_marks,
        validity_days: testSeries.validity_days,
        created_at: testSeries.created_at,
        updated_at: testSeries.updated_at
      };

      res.json({
        success: true,
        data: updatedData,
        message: 'Test series updated successfully'
      });
    } catch (error) {
      console.error('Error updating test series:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update test series'
      });
    }
  }

  // Delete test series
  async deleteTestSeries(req, res) {
    try {
      const { uuid } = req.params;

      const testSeries = await TestSeries.findOne({
        attributes: ['id', 'uuid', 'name', 'description', 'is_active'],
        where: { uuid }
      });
      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test series not found'
        });
      }

      await testSeries.destroy();

      res.json({
        success: true,
        message: 'Test series deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting test series:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete test series'
      });
    }
  }

  // =====================
  // CATEGORIES MANAGEMENT
  // =====================

  // Get categories for a test series with pagination, filtering, and statistics
  async getTestSeriesCategories(req, res) {
    try {
      const { testSeriesUuid } = req.params;
      const {
        page = 1,
        limit = 10,
        search = '',
        status = 'all',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // First find the test series
      const testSeries = await TestSeries.findOne({
        attributes: ['id', 'uuid', 'name', 'description', 'is_active', 'created_at', 'updated_at'],
        where: { uuid: testSeriesUuid, is_active: true }
      });

      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test series not found'
        });
      }

      // Build where clause
      let where = { test_series_id: testSeries.id };
      if (status === 'active') {
        where.is_active = true;
      } else if (status === 'inactive') {
        where.is_active = false;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      // Get paginated categories
      const { count, rows: categories } = await Category.findAndCountAll({
        where,
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset,
        include: [{
          model: SubCategory,
          as: 'subCategories',
          attributes: ['id'],
          required: false
        }]
      });

      // Get statistics
      const stats = {
        total: await Category.count({ where: { test_series_id: testSeries.id } }),
        active: await Category.count({ where: { test_series_id: testSeries.id, is_active: true } }),
        inactive: await Category.count({ where: { test_series_id: testSeries.id, is_active: false } }),
        withSubCategories: await Category.count({
          where: { test_series_id: testSeries.id },
          include: [{
            model: SubCategory,
            as: 'subCategories',
            required: true
          }]
        })
      };

      // Transform data to match frontend expectations
      const transformedTestSeries = {
        id: testSeries.id,
        uuid: testSeries.uuid,
        title: testSeries.name,
        description: testSeries.description,
        is_active: testSeries.is_active,
        created_at: testSeries.created_at,
        updated_at: testSeries.updated_at
      };

      const transformedCategories = categories.map(category => ({
        ...category.toJSON(),
        subCategories_count: category.subCategories ? category.subCategories.length : 0
      }));

      res.json({
        success: true,
        data: {
          testSeries: transformedTestSeries,
          categories: transformedCategories
        },
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        stats
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories'
      });
    }
  }

  // Create new category
  async createCategory(req, res) {
    try {
      const { testSeriesUuid } = req.params;
      const { name, description, name_gujarati, description_gujarati, is_active } = req.body;

      const testSeries = await TestSeries.findOne({
        attributes: ['id', 'uuid', 'name', 'description', 'is_active'],
        where: { uuid: testSeriesUuid, is_active: true }
      });

      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test series not found'
        });
      }

      const category = await Category.create({
        test_series_id: testSeries.id,
        name,
        description,
        name_gujarati,
        description_gujarati,
        is_active: is_active !== undefined ? is_active : true
      });

      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully'
      });
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create category'
      });
    }
  }

  // Bulk operations for categories
  async bulkOperationsCategories(req, res) {
    try {
      const { action, categoryIds } = req.body;

      if (!action || !categoryIds || !Array.isArray(categoryIds)) {
        return res.status(400).json({
          success: false,
          message: 'Action and categoryIds array are required'
        });
      }

      let message = '';
      let updateData = {};

      switch (action) {
        case 'delete':
          await Category.destroy({
            where: { uuid: { [Op.in]: categoryIds } }
          });
          message = `${categoryIds.length} categories deleted successfully`;
          break;
        case 'activate':
          updateData = { is_active: true };
          await Category.update(updateData, {
            where: { uuid: { [Op.in]: categoryIds } }
          });
          message = `${categoryIds.length} categories activated successfully`;
          break;
        case 'deactivate':
          updateData = { is_active: false };
          await Category.update(updateData, {
            where: { uuid: { [Op.in]: categoryIds } }
          });
          message = `${categoryIds.length} categories deactivated successfully`;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action. Supported actions: delete, activate, deactivate'
          });
      }

      res.json({
        success: true,
        message,
        data: { action, count: categoryIds.length }
      });
    } catch (error) {
      console.error('Error in bulk operations for categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk operations'
      });
    }
  }

  // Update category
  async updateCategory(req, res) {
    try {
      const { uuid, categoryUuid } = req.params;
      const categoryId = uuid || categoryUuid;
      const {
        name,
        description,
        name_gujarati,
        description_gujarati,
        is_active,
        negative_marking_enabled,
        negative_marks_per_wrong,
        test_duration_minutes,
        is_free_in_paid_series
      } = req.body;

      const category = await Category.findOne({ where: { uuid: categoryId } });
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Prepare update data
      const updateData = {
        name,
        description,
        name_gujarati,
        description_gujarati,
        is_active
      };

      // Add negative marking fields if provided
      if (negative_marking_enabled !== undefined) {
        updateData.negative_marking_enabled = negative_marking_enabled;
      }
      if (negative_marks_per_wrong !== undefined) {
        updateData.negative_marks_per_wrong = negative_marks_per_wrong;
      }

      // Add test duration field if provided
      if (test_duration_minutes !== undefined) {
        updateData.test_duration_minutes = test_duration_minutes;
      }

      // Add is_free_in_paid_series field if provided
      if (is_free_in_paid_series !== undefined) {
        updateData.is_free_in_paid_series = is_free_in_paid_series;
      }

      await category.update(updateData);

      res.json({
        success: true,
        data: category,
        message: 'Category updated successfully'
      });
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update category'
      });
    }
  }

  // Delete category
  async deleteCategory(req, res) {
    try {
      const { uuid, categoryUuid } = req.params;
      const categoryId = uuid || categoryUuid;

      const category = await Category.findOne({ where: { uuid: categoryId } });
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      await category.destroy();

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete category'
      });
    }
  }

  // =====================
  // SUB-CATEGORIES MANAGEMENT
  // =====================

  // Get sub-categories for a category with pagination, filtering, and statistics
  async getCategorySubCategories(req, res) {
    try {
      const { categoryUuid } = req.params;
      const {
        page = 1,
        limit = 10,
        search = '',
        status = 'all',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // First find the category
      const category = await Category.findOne({
        where: { uuid: categoryUuid, is_active: true }
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Build where clause
      let where = { category_id: category.id };
      if (status === 'active') {
        where.is_active = true;
      } else if (status === 'inactive') {
        where.is_active = false;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      // Get paginated sub-categories
      const { count, rows: subCategories } = await SubCategory.findAndCountAll({
        where,
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset,
        include: [{
          model: Test,
          as: 'tests',
          attributes: ['id'],
          required: false
        }]
      });

      // Get statistics
      const stats = {
        total: await SubCategory.count({ where: { category_id: category.id } }),
        active: await SubCategory.count({ where: { category_id: category.id, is_active: true } }),
        inactive: await SubCategory.count({ where: { category_id: category.id, is_active: false } }),
        withTests: await SubCategory.count({
          where: { category_id: category.id },
          include: [{
            model: Test,
            as: 'tests',
            required: true
          }]
        })
      };

      // Transform data
      const transformedSubCategories = subCategories.map(subCategory => ({
        ...subCategory.toJSON(),
        tests_count: subCategory.tests ? subCategory.tests.length : 0
      }));

      res.json({
        success: true,
        data: {
          category,
          subCategories: transformedSubCategories
        },
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        stats
      });
    } catch (error) {
      console.error('Error fetching sub-categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sub-categories'
      });
    }
  }

  // Create new sub-category
  async createSubCategory(req, res) {
    try {
      const { categoryUuid } = req.params;
      const { name, description, name_gujarati, description_gujarati, is_active } = req.body;

      const category = await Category.findOne({
        where: { uuid: categoryUuid, is_active: true }
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const subCategory = await SubCategory.create({
        category_id: category.id,
        name,
        description,
        name_gujarati,
        description_gujarati,
        is_active: is_active !== undefined ? is_active : true
      });

      res.status(201).json({
        success: true,
        data: subCategory,
        message: 'Sub-category created successfully'
      });
    } catch (error) {
      console.error('Error creating sub-category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create sub-category'
      });
    }
  }

  // Bulk operations for sub-categories
  async bulkOperationsSubCategories(req, res) {
    try {
      const { action, subCategoryIds } = req.body;

      if (!action || !subCategoryIds || !Array.isArray(subCategoryIds)) {
        return res.status(400).json({
          success: false,
          message: 'Action and subCategoryIds array are required'
        });
      }

      let message = '';
      let updateData = {};

      switch (action) {
        case 'delete':
          await SubCategory.destroy({
            where: { uuid: { [Op.in]: subCategoryIds } }
          });
          message = `${subCategoryIds.length} sub-categories deleted successfully`;
          break;
        case 'activate':
          updateData = { is_active: true };
          await SubCategory.update(updateData, {
            where: { uuid: { [Op.in]: subCategoryIds } }
          });
          message = `${subCategoryIds.length} sub-categories activated successfully`;
          break;
        case 'deactivate':
          updateData = { is_active: false };
          await SubCategory.update(updateData, {
            where: { uuid: { [Op.in]: subCategoryIds } }
          });
          message = `${subCategoryIds.length} sub-categories deactivated successfully`;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action. Supported actions: delete, activate, deactivate'
          });
      }

      res.json({
        success: true,
        message,
        data: { action, count: subCategoryIds.length }
      });
    } catch (error) {
      console.error('Error in bulk operations for sub-categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk operations'
      });
    }
  }

  // Update sub-category
  async updateSubCategory(req, res) {
    try {
      const { uuid } = req.params;
      const { name, description, name_gujarati, description_gujarati, is_active } = req.body;

      const subCategory = await SubCategory.findOne({ where: { uuid } });
      if (!subCategory) {
        return res.status(404).json({
          success: false,
          message: 'Sub-category not found'
        });
      }

      await subCategory.update({ name, description, name_gujarati, description_gujarati, is_active });

      res.json({
        success: true,
        data: subCategory,
        message: 'Sub-category updated successfully'
      });
    } catch (error) {
      console.error('Error updating sub-category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update sub-category'
      });
    }
  }

  // Delete sub-category
  async deleteSubCategory(req, res) {
    try {
      const { uuid } = req.params;

      const subCategory = await SubCategory.findOne({ where: { uuid } });
      if (!subCategory) {
        return res.status(404).json({
          success: false,
          message: 'Sub-category not found'
        });
      }

      await subCategory.update({ is_active: false });

      res.json({
        success: true,
        message: 'Sub-category deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting sub-category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete sub-category'
      });
    }
  }

  // =====================
  // TESTS MANAGEMENT
  // =====================

  // Get tests for a sub-category with pagination, filtering, and statistics
  async getSubCategoryTests(req, res) {
    try {
      const { subCategoryUuid } = req.params;
      const {
        page = 1,
        limit = 10,
        search = '',
        status = 'all',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // First find the sub-category
      const subCategory = await SubCategory.findOne({
        where: { uuid: subCategoryUuid, is_active: true }
      });

      if (!subCategory) {
        return res.status(404).json({
          success: false,
          message: 'Sub-category not found'
        });
      }

      // Build where clause
      let where = { sub_category_id: subCategory.id };
      if (status === 'active') {
        where.is_active = true;
      } else if (status === 'inactive') {
        where.is_active = false;
      }

      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      // Get paginated tests
      const { count, rows: tests } = await Test.findAndCountAll({
        where,
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset,
        include: [{
          model: Question,
          as: 'questions',
          attributes: ['id'],
          required: false
        }]
      });

      // Get statistics
      const stats = {
        total: await Test.count({ where: { sub_category_id: subCategory.id } }),
        active: await Test.count({ where: { sub_category_id: subCategory.id, is_active: true } }),
        inactive: await Test.count({ where: { sub_category_id: subCategory.id, is_active: false } }),
        withQuestions: await Test.count({
          where: { sub_category_id: subCategory.id },
          include: [{
            model: Question,
            as: 'questions',
            required: true
          }]
        })
      };

      // Transform data
      const transformedTests = tests.map(test => ({
        ...test.toJSON(),
        questions_count: test.questions ? test.questions.length : 0
      }));

      res.json({
        success: true,
        data: {
          subCategory,
          tests: transformedTests
        },
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        stats
      });
    } catch (error) {
      console.error('Error fetching tests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tests'
      });
    }
  }

  // Create new test
  async createTest(req, res) {
    try {
      const { subCategoryUuid } = req.params;
      const {
        title,
        description,
        duration_minutes,
        total_marks,
        title_gujarati,
        description_gujarati,
        is_active,
        is_demo,
        is_free_in_paid_series,
        negative_marking_enabled,
        negative_marks_per_wrong,
        is_one_time_only,
        max_duration_minutes,
        attempt_restrictions,
        passing_marks,
        instructions,
        instructions_gujarati
      } = req.body;

      const subCategory = await SubCategory.findOne({
        where: { uuid: subCategoryUuid, is_active: true }
      });

      if (!subCategory) {
        return res.status(404).json({
          success: false,
          message: 'Sub-category not found'
        });
      }

      const test = await Test.create({
        sub_category_id: subCategory.id,
        title,
        description,
        duration_minutes: duration_minutes || 60,
        total_marks: total_marks || 0,
        title_gujarati,
        description_gujarati,
        is_active: is_active !== undefined ? is_active : true,
        is_demo: is_demo || false,
        is_free_in_paid_series: is_free_in_paid_series || false,
        negative_marking_enabled: negative_marking_enabled || false,
        negative_marks_per_wrong: negative_marks_per_wrong || 0.25,
        is_one_time_only: is_one_time_only || false,
        max_duration_minutes: max_duration_minutes || null,
        attempt_restrictions: attempt_restrictions || null,
        passing_marks: passing_marks || null,
        instructions: instructions || null,
        instructions_gujarati: instructions_gujarati || null
      });

      res.status(201).json({
        success: true,
        data: test,
        message: 'Test created successfully'
      });
    } catch (error) {
      console.error('Error creating test:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create test'
      });
    }
  }

  // Bulk operations for tests
  async bulkOperationsTests(req, res) {
    try {
      const { action, testIds } = req.body;

      if (!action || !testIds || !Array.isArray(testIds)) {
        return res.status(400).json({
          success: false,
          message: 'Action and testIds array are required'
        });
      }

      let message = '';
      let updateData = {};

      switch (action) {
        case 'delete':
          await Test.destroy({
            where: { uuid: { [Op.in]: testIds } }
          });
          message = `${testIds.length} tests deleted successfully`;
          break;
        case 'activate':
          updateData = { is_active: true };
          await Test.update(updateData, {
            where: { uuid: { [Op.in]: testIds } }
          });
          message = `${testIds.length} tests activated successfully`;
          break;
        case 'deactivate':
          updateData = { is_active: false };
          await Test.update(updateData, {
            where: { uuid: { [Op.in]: testIds } }
          });
          message = `${testIds.length} tests deactivated successfully`;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action. Supported actions: delete, activate, deactivate'
          });
      }

      res.json({
        success: true,
        message,
        data: { action, count: testIds.length }
      });
    } catch (error) {
      console.error('Error in bulk operations for tests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk operations'
      });
    }
  }

  // Update test
  async updateTest(req, res) {
    try {
      const { uuid } = req.params;
      const { title, description, duration_minutes, total_marks, title_gujarati, description_gujarati, is_active } = req.body;

      const test = await Test.findOne({ where: { uuid } });
      if (!test) {
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }

      await test.update({
        title,
        description,
        duration_minutes,
        total_marks,
        title_gujarati,
        description_gujarati,
        is_active
      });

      res.json({
        success: true,
        data: test,
        message: 'Test updated successfully'
      });
    } catch (error) {
      console.error('Error updating test:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update test'
      });
    }
  }

  // Delete test
  async deleteTest(req, res) {
    try {
      const { uuid } = req.params;

      const test = await Test.findOne({ where: { uuid } });
      if (!test) {
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }

      await test.update({ is_active: false });

      res.json({
        success: true,
        message: 'Test deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting test:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete test'
      });
    }
  }

  // =====================
  // QUESTIONS MANAGEMENT
  // =====================

  // Get questions for a test with pagination, filtering, and statistics
  async getTestQuestions(req, res) {
    try {
      const { testUuid } = req.params;
      const {
        page = 1,
        limit = 10,
        search = '',
        status = 'all',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // First find the test
      const test = await Test.findOne({
        where: { uuid: testUuid, is_active: true }
      });

      if (!test) {
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }

      // Build where clause
      let where = { test_id: test.id };
      if (status === 'active') {
        where.is_active = true;
      } else if (status === 'inactive') {
        where.is_active = false;
      }

      if (search) {
        where[Op.or] = [
          { question_text: { [Op.like]: `%${search}%` } },
          { explanation: { [Op.like]: `%${search}%` } }
        ];
      }

      // Get paginated questions - prioritize question_order if available
      const orderArray = [[sortBy, sortOrder]];
      if (sortBy !== 'question_order') {
        orderArray.push(['question_order', 'ASC']);
      }

      const { count, rows: questions } = await Question.findAndCountAll({
        where,
        order: orderArray,
        limit: parseInt(limit),
        offset
      });

      // Get statistics
      const stats = {
        total: await Question.count({ where: { test_id: test.id } }),
        active: await Question.count({ where: { test_id: test.id, is_active: true } }),
        inactive: await Question.count({ where: { test_id: test.id, is_active: false } }),
        totalMarks: await Question.sum('marks', { where: { test_id: test.id, is_active: true } }) || 0
      };

      // Calculate average marks per question
      stats.averageMarks = stats.total > 0 ? (stats.totalMarks / stats.total).toFixed(1) : 0;

      res.json({
        success: true,
        data: {
          test,
          questions
        },
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        stats
      });
    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch questions'
      });
    }
  }

  // Create new question
  async createQuestion(req, res) {
    try {
      const { testUuid } = req.params;
      const {
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        marks,
        question_text_gujarati,
        option_a_gujarati,
        option_b_gujarati,
        option_c_gujarati,
        option_d_gujarati,
        explanation_gujarati,
        is_active
      } = req.body;

      const test = await Test.findOne({
        where: { uuid: testUuid, is_active: true }
      });

      if (!test) {
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }

      const question = await Question.create({
        test_id: test.id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        marks: marks || 1,
        question_text_gujarati,
        option_a_gujarati,
        option_b_gujarati,
        option_c_gujarati,
        option_d_gujarati,
        explanation_gujarati,
        is_active: is_active !== undefined ? is_active : true
      });

      // Update test total marks
      const totalMarks = await Question.sum('marks', {
        where: { test_id: test.id, is_active: true }
      });
      await test.update({ total_marks: totalMarks });

      res.status(201).json({
        success: true,
        data: question,
        message: 'Question created successfully'
      });
    } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create question'
      });
    }
  }

  // Update question
  async updateQuestion(req, res) {
    try {
      const { uuid, questionUuid } = req.params;
      const questionId = uuid || questionUuid;
      const {
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        marks,
        question_text_gujarati,
        option_a_gujarati,
        option_b_gujarati,
        option_c_gujarati,
        option_d_gujarati,
        explanation_gujarati,
        is_active
      } = req.body;

      const question = await Question.findOne({
        where: { uuid: questionId },
        include: [{ model: Test, as: 'test' }]
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      await question.update({
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        marks,
        question_text_gujarati,
        option_a_gujarati,
        option_b_gujarati,
        option_c_gujarati,
        option_d_gujarati,
        explanation_gujarati,
        is_active
      });

      // Update test total marks (only if question belongs to a test)
      if (question.test_id && question.test) {
        const totalMarks = await Question.sum('marks', {
          where: { test_id: question.test_id, is_active: true }
        });
        await question.test.update({ total_marks: totalMarks });
      }

      res.json({
        success: true,
        data: question,
        message: 'Question updated successfully'
      });
    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update question'
      });
    }
  }

  // Delete question
  async deleteQuestion(req, res) {
    try {
      const { uuid, questionUuid } = req.params;
      const questionId = uuid || questionUuid;

      const question = await Question.findOne({
        where: { uuid: questionId },
        include: [{ model: Test, as: 'test' }]
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      await question.destroy();

      // Update test total marks
      // const totalMarks = await Question.sum('marks', {
      //   where: { test_id: question.test_id, is_active: true }
      // });
      // await question.test.update({ total_marks: totalMarks });

      res.json({
        success: true,
        message: 'Question deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete question'
      });
    }
  }

  // Bulk operations for questions
  async bulkOperationsQuestions(req, res) {
    try {
      const { action, questionIds } = req.body;

      if (!action || !questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Action and questionIds array are required'
        });
      }

      let updateData = {};
      let message = '';

      switch (action) {
        case 'delete':
          updateData = { is_active: false };
          message = `${questionIds.length} questions deleted successfully`;
          break;
        case 'activate':
          updateData = { is_active: true };
          message = `${questionIds.length} questions activated successfully`;
          break;
        case 'deactivate':
          updateData = { is_active: false };
          message = `${questionIds.length} questions deactivated successfully`;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action. Use: delete, activate, or deactivate'
          });
      }

      // Update questions
      const [updatedCount] = await Question.update(updateData, {
        where: {
          uuid: {
            [Op.in]: questionIds
          }
        }
      });

      if (updatedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No questions found to update'
        });
      }

      // Update test total marks for affected tests
      const affectedQuestions = await Question.findAll({
        where: {
          uuid: {
            [Op.in]: questionIds
          }
        },
        include: [{ model: Test, as: 'test' }]
      });

      const testIds = [...new Set(affectedQuestions.map(q => q.test_id))];
      for (const testId of testIds) {
        const totalMarks = await Question.sum('marks', {
          where: { test_id: testId, is_active: true }
        });
        await Test.update({ total_marks: totalMarks || 0 }, { where: { id: testId } });
      }

      res.json({
        success: true,
        message,
        updatedCount
      });
    } catch (error) {
      console.error('Error in bulk operations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk operation'
      });
    }
  }

  // ====================================
  // SIMPLIFIED HIERARCHY METHODS (NEW)
  // ====================================

  // Get category content (subcategories OR questions) with button state
  async getCategoryContent(req, res) {
    try {
      const { categoryUuid } = req.params;

      const category = await Category.findOne({
        where: { uuid: categoryUuid },
        include: [
          // Get child categories — separate:true required so Sequelize actually applies the order
          {
            model: Category,
            as: 'childCategories',
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']]
          },
          // Get questions directly — separate:true required so Sequelize actually applies the order
          {
            model: Question,
            as: 'questions',
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']]
          },
          // Get parent for breadcrumb
          {
            model: Category,
            as: 'parentCategory',
            attributes: ['id', 'uuid', 'name', 'hierarchy_level']
          },
          // Get the owning course for breadcrumb
          {
            model: TestSeries,
            as: 'testSeries',
            attributes: ['id', 'uuid', 'name', 'description']
          }
        ]
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Walk up the parent chain to build the full breadcrumb trail (root-first),
      // since parentCategory only gives one level and nested categories can go deeper.
      const ancestors = [];
      let parentId = category.parent_category_id;
      while (parentId) {
        const parent = await Category.findByPk(parentId, {
          attributes: ['id', 'uuid', 'name', 'hierarchy_level', 'parent_category_id']
        });
        if (!parent) break;
        ancestors.unshift({
          id: parent.id,
          uuid: parent.uuid,
          name: parent.name,
          hierarchy_level: parent.hierarchy_level
        });
        parentId = parent.parent_category_id;
      }

      // Determine button states based on node_type
      const buttons_state = {
        can_add_category: category.node_type === 'unset' || category.node_type === 'container',
        can_add_question: category.node_type === 'unset' || category.node_type === 'question_holder'
      };

      // Determine content type and data
      let content = [];
      let content_type = 'empty';

      // Priority-based logic: Check actual content regardless of node_type
      if (category.questions?.length > 0) {
        // Category has questions → show questions
        content = category.questions;
        content_type = 'questions';
      } else if (category.childCategories?.length > 0) {
        // Category has subcategories → show categories
        content = category.childCategories;
        content_type = 'categories';
      }
      // Otherwise → content_type remains 'empty'

      res.json({
        success: true,
        data: {
          test_series: category.testSeries ? {
            id: category.testSeries.id,
            uuid: category.testSeries.uuid,
            name: category.testSeries.name,
            description: category.testSeries.description
          } : null,
          category: {
            id: category.id,
            uuid: category.uuid,
            name: category.name,
            description: category.description,
            node_type: category.node_type,
            hierarchy_level: category.hierarchy_level,
            parent_category: category.parentCategory,
            ancestors,
            negative_marking_enabled: category.negative_marking_enabled,
            negative_marks_per_wrong: category.negative_marks_per_wrong
          },
          content_type,
          content,
          buttons_state,
          statistics: {
            child_categories_count: category.childCategories?.length || 0,
            questions_count: category.questions?.length || 0,
            hierarchy_level: category.hierarchy_level,
            is_leaf_category: (category.childCategories?.length || 0) === 0,
            content_distribution: {
              direct_questions: category.questions?.length || 0,
              nested_categories: category.childCategories?.length || 0
            }
          }
        }
      });

    } catch (error) {
      console.error('Error fetching category content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch category content'
      });
    }
  }

  // Get root categories for a test series
  async getTestSeriesRootCategories(req, res) {
    try {
      const { testSeriesUuid } = req.params;

      // First get the test series
      const testSeries = await TestSeries.findOne({
        where: { uuid: testSeriesUuid }
      });

      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test series not found'
        });
      }

      // Get root categories (hierarchy_level = 0, parent_category_id = NULL)
      const rootCategories = await Category.findAll({
        where: {
          test_series_id: testSeries.id,
          hierarchy_level: 0,
          parent_category_id: null,
          // is_active: true
        },
        attributes: [
          'id', 'uuid', 'test_series_id', 'name', 'description',
          'name_gujarati', 'description_gujarati', 'is_active',
          'node_type', 'parent_category_id', 'hierarchy_level',
          'display_order', 'createdAt', 'updatedAt',
          // Include negative marking and test timing fields
          'negative_marking_enabled', 'negative_marks_per_wrong', 'test_duration_minutes',
          // Include free in paid series field
          'is_free_in_paid_series'
        ],
        include: [
          // Include child categories count
          {
            model: Category,
            as: 'childCategories',
            attributes: [],
            required: false
          },
          // Include questions count
          {
            model: Question,
            as: 'questions',
            attributes: [],
            required: false
          }
        ],
        order: [['display_order', 'ASC'], ['created_at', 'ASC']]
      });

      // For now, don't show any root questions to fix the button state issue
      // TODO: We need to properly implement test_series_id on questions to associate them correctly
      // This is a temporary fix to ensure fresh test series show both buttons enabled
      const rootQuestions = [];

      // Determine content type and button states based on what exists
      let contentType = 'empty';
      let content = [];

      if (rootCategories.length > 0) {
        contentType = 'categories';
        content = rootCategories;
      } else if (rootQuestions.length > 0) {
        contentType = 'questions';
        content = rootQuestions;
      }

      // Correct either-or logic for test series root level:
      // - If no content exists: both buttons enabled (user can choose)
      // - If categories exist: only "Add Category" enabled
      // - If questions exist: only "Add Question" enabled
      const buttons_state = {
        can_add_category: rootQuestions.length === 0,  // Can add categories only if no questions
        can_add_question: rootCategories.length === 0  // Can add questions only if no categories
      };

      res.json({
        success: true,
        data: {
          test_series: {
            id: testSeries.id,
            uuid: testSeries.uuid,
            name: testSeries.name,
            description: testSeries.description
          },
          content_type: contentType,
          content: content,
          buttons_state,
          statistics: {
            root_categories_count: rootCategories.length,
            root_questions_count: rootQuestions.length
          }
        }
      });

    } catch (error) {
      console.error('Error fetching root categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch root categories'
      });
    }
  }

  // Create subcategory
  async createSubCategory(req, res) {
    try {
      const { parentUuid } = req.params;
      const {
        name,
        description,
        name_gujarati,
        description_gujarati,
        testSeriesUuid,
        negative_marking_enabled,
        negative_marks_per_wrong,
        test_duration_minutes
      } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
      }

      // Get parent category or test series
      let parentCategory = null;
      let testSeriesId = null;
      let hierarchyLevel = 0;

      if (parentUuid) {
        parentCategory = await Category.findOne({
          where: { uuid: parentUuid }
        });

        if (!parentCategory) {
          return res.status(404).json({
            success: false,
            message: 'Parent category not found'
          });
        }

        // Check if parent can have subcategories
        if (parentCategory.node_type === 'question_holder') {
          return res.status(400).json({
            success: false,
            message: 'Cannot add subcategories to a category that contains questions'
          });
        }

        testSeriesId = parentCategory.test_series_id;
        hierarchyLevel = parentCategory.hierarchy_level + 1;
      } else {
        // Creating at root level - need test series UUID
        if (!testSeriesUuid) {
          return res.status(400).json({
            success: false,
            message: 'Test series UUID is required for root categories'
          });
        }

        const testSeries = await TestSeries.findOne({
          where: { uuid: testSeriesUuid }
        });

        if (!testSeries) {
          return res.status(404).json({
            success: false,
            message: 'Test series not found'
          });
        }

        testSeriesId = testSeries.id;
        hierarchyLevel = 0;

        // Removed constraint enforcement due to question-test series association issue
        // TODO: Implement proper test_series_id tracking for questions
      }

      // Auto-assign display_order as max + 1 among siblings
      const siblingMax = await Category.findOne({
        attributes: [[Category.sequelize.fn('MAX', Category.sequelize.col('display_order')), 'maxOrder']],
        where: {
          test_series_id: testSeriesId,
          parent_category_id: parentCategory ? parentCategory.id : null
        },
        raw: true
      });
      const nextDisplayOrder = (siblingMax?.maxOrder || 0) + 1;

      // Create the new category
      const newCategory = await Category.create({
        test_series_id: testSeriesId,
        parent_category_id: parentCategory ? parentCategory.id : null,
        name: name.trim(),
        description: description?.trim() || null,
        name_gujarati: name_gujarati?.trim() || null,
        description_gujarati: description_gujarati?.trim() || null,
        hierarchy_level: hierarchyLevel,
        node_type: 'unset',
        display_order: nextDisplayOrder,
        negative_marking_enabled: negative_marking_enabled || false,
        negative_marks_per_wrong: negative_marks_per_wrong || 0.25,
        test_duration_minutes: test_duration_minutes || 60
      });

      // If parent exists, update its node_type to 'container'
      if (parentCategory && parentCategory.node_type === 'unset') {
        await parentCategory.update({
          node_type: 'container'
        });
      }

      res.json({
        success: true,
        data: newCategory,
        message: 'Category created successfully'
      });

    } catch (error) {
      console.error('Error creating subcategory:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create subcategory'
      });
    }
  }

  // Create question in category
  async createQuestionInCategory(req, res) {
    try {
      const { categoryUuid } = req.params;
      const {
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        marks = 1,
        question_text_gujarati,
        option_a_gujarati,
        option_b_gujarati,
        option_c_gujarati,
        option_d_gujarati,
        explanation_gujarati
      } = req.body;

      // Smart validation: Check if we have content in at least one language
      const hasEnglishQuestion = question_text?.trim();
      const hasGujaratiQuestion = question_text_gujarati?.trim();

      if (!hasEnglishQuestion && !hasGujaratiQuestion) {
        return res.status(400).json({
          success: false,
          message: 'Question text is required in English or Gujarati or both'
        });
      }

      // Validate options - at least one language required for each option
      const optionPairs = [
        { en: option_a?.trim(), gu: option_a_gujarati?.trim(), label: 'Option A' },
        { en: option_b?.trim(), gu: option_b_gujarati?.trim(), label: 'Option B' },
        { en: option_c?.trim(), gu: option_c_gujarati?.trim(), label: 'Option C' },
        { en: option_d?.trim(), gu: option_d_gujarati?.trim(), label: 'Option D' }
      ];

      for (const pair of optionPairs) {
        if (!pair.en && !pair.gu) {
          return res.status(400).json({
            success: false,
            message: `${pair.label} is required in English or Gujarati or both`
          });
        }
      }

      // Validate correct answer
      if (!correct_answer) {
        return res.status(400).json({
          success: false,
          message: 'Correct answer is required'
        });
      }

      // Get the category
      const category = await Category.findOne({
        where: { uuid: categoryUuid }
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Check if category can have questions
      if (category.node_type === 'container') {
        return res.status(400).json({
          success: false,
          message: 'Cannot add questions to a category that contains subcategories'
        });
      }

      // Auto-assign display_order as max + 1 among questions in same category
      const qMax = await Question.findOne({
        attributes: [[Question.sequelize.fn('MAX', Question.sequelize.col('display_order')), 'maxOrder']],
        where: { category_id: category.id },
        raw: true
      });
      const nextQDisplayOrder = (qMax?.maxOrder || 0) + 1;

      // Create the question with a temporary test_id = 1 (we'll fix this properly later)
      const newQuestion = await Question.create({
        test_id: 1, // Temporary workaround - we need to make this nullable in DB
        category_id: category.id,
        question_text: question_text.trim(),
        option_a: option_a.trim(),
        option_b: option_b.trim(),
        option_c: option_c.trim(),
        option_d: option_d.trim(),
        correct_answer,
        explanation: explanation?.trim() || null,
        marks: parseInt(marks) || 1,
        display_order: nextQDisplayOrder,
        // Gujarati fields
        question_text_gujarati: question_text_gujarati?.trim() || null,
        option_a_gujarati: option_a_gujarati?.trim() || null,
        option_b_gujarati: option_b_gujarati?.trim() || null,
        option_c_gujarati: option_c_gujarati?.trim() || null,
        option_d_gujarati: option_d_gujarati?.trim() || null,
        explanation_gujarati: explanation_gujarati?.trim() || null
      });

      // Update category node_type to 'question_holder'
      if (category.node_type === 'unset') {
        await category.update({
          node_type: 'question_holder'
        });
      }

      res.json({
        success: true,
        data: newQuestion,
        message: 'Question created successfully'
      });

    } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create question'
      });
    }
  }

  // Create question directly in test series (root level)
  async createQuestionInTestSeries(req, res) {
    try {
      const { testSeriesUuid } = req.params;
      const {
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        marks = 1,
        question_text_gujarati,
        option_a_gujarati,
        option_b_gujarati,
        option_c_gujarati,
        option_d_gujarati,
        explanation_gujarati
      } = req.body;

      // Smart validation: Check if we have content in at least one language
      const hasEnglishQuestion = question_text?.trim();
      const hasGujaratiQuestion = question_text_gujarati?.trim();

      if (!hasEnglishQuestion && !hasGujaratiQuestion) {
        return res.status(400).json({
          success: false,
          message: 'Question text is required in English or Gujarati or both'
        });
      }

      // Validate options - at least one language required for each option
      const optionPairs = [
        { en: option_a?.trim(), gu: option_a_gujarati?.trim(), label: 'Option A' },
        { en: option_b?.trim(), gu: option_b_gujarati?.trim(), label: 'Option B' },
        { en: option_c?.trim(), gu: option_c_gujarati?.trim(), label: 'Option C' },
        { en: option_d?.trim(), gu: option_d_gujarati?.trim(), label: 'Option D' }
      ];

      for (const pair of optionPairs) {
        if (!pair.en && !pair.gu) {
          return res.status(400).json({
            success: false,
            message: `${pair.label} is required in English or Gujarati or both`
          });
        }
      }

      // Validate correct answer
      if (!correct_answer) {
        return res.status(400).json({
          success: false,
          message: 'Correct answer is required'
        });
      }

      // Get the test series
      const testSeries = await TestSeries.findOne({
        where: { uuid: testSeriesUuid }
      });

      if (!testSeries) {
        return res.status(404).json({
          success: false,
          message: 'Test series not found'
        });
      }

      // Removed constraint enforcement due to complexity of tracking questions properly
      // TODO: Implement proper test_series_id tracking for questions and re-enable constraints

      // Create the question at root level (no category_id, no test_id)
      const newQuestion = await Question.create({
        test_id: 1, // Temporary workaround - we need this for now due to model constraint
        question_text: question_text.trim(),
        option_a: option_a.trim(),
        option_b: option_b.trim(),
        option_c: option_c.trim(),
        option_d: option_d.trim(),
        correct_answer,
        explanation: explanation?.trim() || null,
        marks: parseInt(marks) || 1,
        display_order: 0,
        // Gujarati fields
        question_text_gujarati: question_text_gujarati?.trim() || null,
        option_a_gujarati: option_a_gujarati?.trim() || null,
        option_b_gujarati: option_b_gujarati?.trim() || null,
        option_c_gujarati: option_c_gujarati?.trim() || null,
        option_d_gujarati: option_d_gujarati?.trim() || null,
        explanation_gujarati: explanation_gujarati?.trim() || null
      });

      res.json({
        success: true,
        data: newQuestion,
        message: 'Question created successfully'
      });

    } catch (error) {
      console.error('Error creating question in test series:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create question'
      });
    }
  }

  // Helper methods for detailed statistics
  async getMaxHierarchyLevel(testSeriesId) {
    const { sequelize } = require('../models');
    const result = await Category.findOne({
      where: { test_series_id: testSeriesId },
      attributes: [[sequelize.fn('MAX', sequelize.col('hierarchy_level')), 'maxLevel']],
      raw: true
    });
    return result?.maxLevel || 0;
  }

  async getTotalNestedCategories(testSeriesId) {
    const count = await Category.count({
      where: {
        test_series_id: testSeriesId,
        hierarchy_level: { [Op.gt]: 0 }
      }
    });
    return count;
  }

  async getTotalQuestionsAllLevels(testSeriesId) {
    const count = await Question.count({
      include: [{
        model: Category,
        as: 'category',
        where: { test_series_id: testSeriesId },
        attributes: []
      }]
    });
    return count;
  }

  async getCategoriesWithSubcategories(testSeriesId) {
    const result = await Category.findAll({
      where: { test_series_id: testSeriesId },
      include: [{
        model: Category,
        as: 'childCategories',
        attributes: ['id'],
        required: true
      }],
      attributes: ['id'],
      group: ['Category.id']
    });
    return result.length;
  }

  async getCategoriesWithQuestions(testSeriesId) {
    const result = await Category.findAll({
      where: { test_series_id: testSeriesId },
      include: [{
        model: Question,
        as: 'questions',
        attributes: ['id'],
        required: true
      }],
      attributes: ['id'],
      group: ['Category.id']
    });
    return result.length;
  }

  async getLeafCategories(testSeriesId) {
    const allCategories = await Category.findAll({
      where: { test_series_id: testSeriesId },
      attributes: ['id']
    });

    const parentCategories = await Category.findAll({
      where: {
        test_series_id: testSeriesId,
        parent_category_id: { [Op.not]: null }
      },
      attributes: ['parent_category_id'],
      group: ['parent_category_id']
    });

    const parentIds = parentCategories.map(cat => cat.parent_category_id);
    return allCategories.length - parentIds.length;
  }

  async getActiveCategoriesCount(testSeriesId) {
    return await Category.count({
      where: {
        test_series_id: testSeriesId,
        is_active: true
      }
    });
  }

  async getInactiveCategoriesCount(testSeriesId) {
    return await Category.count({
      where: {
        test_series_id: testSeriesId,
        is_active: false
      }
    });
  }

  async getActiveQuestionsCount(testSeriesId) {
    return await Question.count({
      include: [{
        model: Category,
        as: 'category',
        where: { test_series_id: testSeriesId },
        attributes: []
      }],
      where: { is_active: true }
    });
  }

  async getInactiveQuestionsCount(testSeriesId) {
    return await Question.count({
      include: [{
        model: Category,
        as: 'category',
        where: { test_series_id: testSeriesId },
        attributes: []
      }],
      where: { is_active: false }
    });
  }

  // Additional helper methods for category-level statistics
  async getTotalDescendantCategories(categoryId) {
    const descendants = await Category.findAll({
      where: { parent_category_id: categoryId },
      include: [{
        model: Category,
        as: 'childCategories',
        include: [{
          model: Category,
          as: 'childCategories',
          // Continue recursively if needed
        }]
      }]
    });

    let count = descendants.length;
    for (const desc of descendants) {
      count += await this.getTotalDescendantCategories(desc.id);
    }
    return count;
  }

  async getTotalDescendantQuestions(categoryId) {
    // Get direct questions for this category
    const directQuestions = await Question.count({
      where: { category_id: categoryId }
    });

    // Get questions from child categories recursively
    const childCategories = await Category.findAll({
      where: { parent_category_id: categoryId },
      attributes: ['id']
    });

    let childQuestions = 0;
    for (const child of childCategories) {
      childQuestions += await this.getTotalDescendantQuestions(child.id);
    }

    return directQuestions + childQuestions;
  }

  async getActiveChildrenCount(categoryId) {
    return await Category.count({
      where: {
        parent_category_id: categoryId,
        is_active: true
      }
    });
  }

  async getInactiveChildrenCount(categoryId) {
    return await Category.count({
      where: {
        parent_category_id: categoryId,
        is_active: false
      }
    });
  }

  async getActiveQuestionsForCategory(categoryId) {
    return await Question.count({
      where: {
        category_id: categoryId,
        is_active: true
      }
    });
  }

  async getInactiveQuestionsForCategory(categoryId) {
    return await Question.count({
      where: {
        category_id: categoryId,
        is_active: false
      }
    });
  }

  // =====================
  // REORDER METHODS
  // =====================

  // Reorder test series — accepts [{uuid, display_order}]
  async reorderTestSeries(req, res) {
    try {
      const { items } = req.body; // [{uuid, display_order}]
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'items array is required' });
      }

      await Promise.all(
        items.map(({ uuid, display_order }) =>
          TestSeries.update({ display_order }, { where: { uuid } })
        )
      );

      res.json({ success: true, message: 'Test series order updated' });
    } catch (error) {
      console.error('Error reordering test series:', error);
      res.status(500).json({ success: false, message: 'Failed to reorder test series' });
    }
  }

  // Reorder categories within a parent — accepts [{uuid, display_order}]
  async reorderCategories(req, res) {
    try {
      const { items } = req.body; // [{uuid, display_order}]
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'items array is required' });
      }

      await Promise.all(
        items.map(({ uuid, display_order }) =>
          Category.update({ display_order }, { where: { uuid } })
        )
      );

      res.json({ success: true, message: 'Category order updated' });
    } catch (error) {
      console.error('Error reordering categories:', error);
      res.status(500).json({ success: false, message: 'Failed to reorder categories' });
    }
  }

  // Reorder questions within a category — accepts [{uuid, display_order}]
  async reorderQuestions(req, res) {
    try {
      const { items } = req.body; // [{uuid, display_order}]
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'items array is required' });
      }

      await Promise.all(
        items.map(({ uuid, display_order }) =>
          Question.update({ display_order }, { where: { uuid } })
        )
      );

      res.json({ success: true, message: 'Question order updated' });
    } catch (error) {
      console.error('Error reordering questions:', error);
      res.status(500).json({ success: false, message: 'Failed to reorder questions' });
    }
  }
}

module.exports = new TestManagementController();