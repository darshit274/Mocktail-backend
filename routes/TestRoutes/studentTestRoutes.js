const express = require('express');
const router = express.Router();
const { 
  TestSeries, 
  Category, 
  SubCategory, 
  Test, 
  Question,
  TestSession,
  UserAnswer,
  User,
  sequelize 
} = require('../../models');
const AuthToken = require('../../utils/AuthToken');

// Middleware to verify user authentication (optional for some endpoints)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = AuthToken.verifyToken(token);
      const user = await User.findByPk(decoded.userId);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next(); // Continue without auth for public endpoints
  }
};

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = AuthToken.verifyToken(token);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Get all test series (with pagination and filters)
router.get('/test-series', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      pricing_type,
      is_featured
    } = req.query;

    const offset = (page - 1) * limit;
    const where = { is_active: true };

    if (search) {
      where[sequelize.Op.or] = [
        { name: { [sequelize.Op.like]: `%${search}%` } },
        { name_gujarati: { [sequelize.Op.like]: `%${search}%` } },
        { description: { [sequelize.Op.like]: `%${search}%` } },
        { description_gujarati: { [sequelize.Op.like]: `%${search}%` } }
      ];
    }

    if (pricing_type) {
      where.pricing_type = pricing_type;
    }

    if (is_featured !== undefined) {
      where.is_featured = is_featured === 'true';
    }

    const { count, rows } = await TestSeries.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      attributes: [
        'id', 'uuid', 'name', 'description', 'name_gujarati', 'description_gujarati',
        'is_active', 'pricing_type', 'price', 'currency', 'demo_tests_count',
        'subscription_duration_days', 'discount_percentage', 'is_featured',
        'created_at', 'updated_at'
      ],
    });

    // Add simplified metadata (avoiding complex associations for now)
    const testSeriesWithMeta = rows.map(series => ({
      ...series.toJSON(),
      categories_count: 0, // Placeholder - will implement when associations are fixed
      tests_count: 0, // Placeholder - will implement when associations are fixed  
      is_subscribed: false // Placeholder - will implement subscription logic later
    }));

    res.json({
      success: true,
      data: testSeriesWithMeta,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching test series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test series',
      error: error.message
    });
  }
});

// Get single test series by UUID
router.get('/test-series/:uuid', optionalAuth, async (req, res) => {
  try {
    const testSeries = await TestSeries.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!testSeries) {
      return res.status(404).json({
        success: false,
        message: 'Test series not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...testSeries.toJSON(),
        categories_count: 0, // Placeholder
        tests_count: 0 // Placeholder
      }
    });
  } catch (error) {
    console.error('Error fetching test series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test series',
      error: error.message
    });
  }
});

// Get categories for a test series
router.get('/test-series/:uuid/categories', optionalAuth, async (req, res) => {
  try {
    const testSeries = await TestSeries.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!testSeries) {
      return res.status(404).json({
        success: false,
        message: 'Test series not found'
      });
    }

    const categories = await Category.findAll({
      where: { 
        test_series_id: testSeries.id,
        is_active: true 
      },
      order: [['created_at', 'ASC']]
    });

    // Add counts for each category
    const categoriesWithMeta = await Promise.all(
      categories.map(async (category) => {
        const sub_categories_count = await SubCategory.count({
          where: { category_id: category.id, is_active: true }
        });

        const tests_count = await Test.count({
          include: [{
            model: SubCategory,
            where: { category_id: category.id }
          }]
        });

        return {
          ...category.toJSON(),
          sub_categories_count,
          tests_count
        };
      })
    );

    res.json({
      success: true,
      data: categoriesWithMeta
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Get single category by UUID
router.get('/categories/:uuid', optionalAuth, async (req, res) => {
  try {
    const category = await Category.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
});

// Get sub-categories for a category
router.get('/categories/:uuid/sub-categories', optionalAuth, async (req, res) => {
  try {
    const category = await Category.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const subCategories = await SubCategory.findAll({
      where: { 
        category_id: category.id,
        is_active: true 
      },
      order: [['created_at', 'ASC']]
    });

    // Add test counts
    const subCategoriesWithMeta = await Promise.all(
      subCategories.map(async (subCategory) => {
        const tests_count = await Test.count({
          where: { sub_category_id: subCategory.id, is_active: true }
        });

        return {
          ...subCategory.toJSON(),
          tests_count
        };
      })
    );

    res.json({
      success: true,
      data: subCategoriesWithMeta
    });
  } catch (error) {
    console.error('Error fetching sub-categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sub-categories',
      error: error.message
    });
  }
});

// Get single sub-category by UUID
router.get('/sub-categories/:uuid', optionalAuth, async (req, res) => {
  try {
    const subCategory = await SubCategory.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: 'Sub-category not found'
      });
    }

    res.json({
      success: true,
      data: subCategory
    });
  } catch (error) {
    console.error('Error fetching sub-category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sub-category',
      error: error.message
    });
  }
});

// Get tests for a sub-category
router.get('/sub-categories/:uuid/tests', optionalAuth, async (req, res) => {
  try {
    const subCategory = await SubCategory.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: 'Sub-category not found'
      });
    }

    const tests = await Test.findAll({
      where: { 
        sub_category_id: subCategory.id,
        is_active: true 
      },
      order: [['created_at', 'ASC']]
    });

    // Add question counts and user attempt info
    const testsWithMeta = await Promise.all(
      tests.map(async (test) => {
        const questions_count = await Question.count({
          where: { test_id: test.id, is_active: true }
        });

        let user_attempts = 0;
        if (req.user) {
          user_attempts = await TestSession.count({
            where: { 
              user_id: req.user.id,
              test_id: test.id,
              status: 'completed'
            }
          });
        }

        return {
          ...test.toJSON(),
          questions_count,
          user_attempts
        };
      })
    );

    res.json({
      success: true,
      data: testsWithMeta
    });
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tests',
      error: error.message
    });
  }
});

// Get single test by UUID
router.get('/tests/:uuid', optionalAuth, async (req, res) => {
  try {
    const test = await Test.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const questions_count = await Question.count({
      where: { test_id: test.id, is_active: true }
    });

    res.json({
      success: true,
      data: {
        ...test.toJSON(),
        questions_count
      }
    });
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test',
      error: error.message
    });
  }
});

// Get questions for a test (requires authentication)
router.get('/tests/:uuid/questions', requireAuth, async (req, res) => {
  try {
    const test = await Test.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const questions = await Question.findAll({
      where: { 
        test_id: test.id,
        is_active: true 
      },
      order: [['id', 'ASC']],
      attributes: [
        'id', 'uuid', 'question_text', 'question_text_gujarati',
        'question_type', 'option_a', 'option_b', 'option_c', 'option_d',
        'option_a_gujarati', 'option_b_gujarati', 'option_c_gujarati', 'option_d_gujarati',
        'marks', 'difficulty_level', 'created_at'
        // Note: correct_answer and explanation are excluded for security
      ]
    });

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions',
      error: error.message
    });
  }
});

// Check subscription access for a test series
router.get('/test-series/:uuid/subscription-access', requireAuth, async (req, res) => {
  try {
    const testSeries = await TestSeries.findOne({
      where: { uuid: req.params.uuid, is_active: true }
    });

    if (!testSeries) {
      return res.status(404).json({
        success: false,
        message: 'Test series not found'
      });
    }

    // If it's a free test series, everyone has access
    if (testSeries.pricing_type === 'free') {
      return res.json({
        success: true,
        data: {
          has_access: true,
          subscription_type: 'free',
          can_access_demo: true,
          demo_tests_remaining: testSeries.demo_tests_count || 0
        }
      });
    }

    // For paid test series, check subscription
    // TODO: Implement actual subscription checking logic
    // For now, returning demo access
    res.json({
      success: true,
      data: {
        has_access: false,
        subscription_type: null,
        expires_at: null,
        can_access_demo: true,
        demo_tests_remaining: testSeries.demo_tests_count || 0
      }
    });
  } catch (error) {
    console.error('Error checking subscription access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription access',
      error: error.message
    });
  }
});

module.exports = router;