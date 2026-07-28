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
  Subscription,
  sequelize,
  Sequelize
} = require('../../models');
const AuthToken = require('../../utils/AuthToken');
const { checkUserTestSeriesAccess } = require('../SubscriptionRoutes/subscriptionAccess');

// Middleware to verify user authentication (optional for some endpoints)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = AuthToken.verifyToken(token);
      const user = await User.findOne({ where: { uuid: decoded.uuid || decoded.id } });
      if (user) {
        req.user = {
          ...user.toJSON(),
          id: user.id,       // Database primary key
          uuid: user.uuid    // User UUID for foreign key relations
        };
      }
    }
    next();
  } catch (error) {
    next(); // Continue without auth for public endpoints
  }
};

const requireAuth = async (req, res, next) => {
  try {
    // console.log('🔍 Auth Debug - Headers:', req.headers.authorization ? 'Present' : 'Missing');
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      // console.log('❌ Auth Debug - No token found');
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // console.log('🔍 Auth Debug - Token length:', token.length);
    // console.log('🔍 Auth Debug - Token preview:', token.substring(0, 20) + '...');
    
    let decoded;
    try {
      decoded = AuthToken.verifyToken(token);
      // console.log('🔍 Auth Debug - Decoded payload:', JSON.stringify(decoded));
    } catch (tokenError) {
      // console.log('❌ Auth Debug - Token verification failed:', tokenError.message);
      return res.status(401).json({ success: false, message: 'Invalid token', error: tokenError.message });
    }
    
    const user = await User.findOne({ where: { uuid: decoded.uuid || decoded.id } });
    // console.log('🔍 Auth Debug - User lookup with UUID:', decoded.id);
    // console.log('🔍 Auth Debug - User found:', user ? `Yes (ID: ${user.id}, UUID: ${user.uuid})` : 'No');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Set consistent user properties for database queries
    req.user = {
      ...user.toJSON(),
      id: user.id,       // Database primary key
      uuid: user.uuid    // User UUID for foreign key relations
    };
    // console.log('✅ Auth Debug - User authenticated:', { id: req.user.id, uuid: req.user.uuid });
    next();
  } catch (error) {
    // console.log('❌ Auth Debug - Error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Note: Test access checking has been temporarily removed
// All authenticated users can access any test

// Debug endpoint to test authentication
router.get('/auth-test', requireAuth, async (req, res) => {
  // console.log('🔍 Auth test - User:', req.user);
  res.json({
    success: true,
    message: 'Authentication successful',
    user: req.user
  });
});

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
      where[Sequelize.Op.or] = [
        { name: { [Sequelize.Op.like]: `%${search}%` } },
        { name_gujarati: { [Sequelize.Op.like]: `%${search}%` } },
        { description: { [Sequelize.Op.like]: `%${search}%` } },
        { description_gujarati: { [Sequelize.Op.like]: `%${search}%` } }
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
        'is_active', 'pricing_type', 'price', 'currency',
        'discount_percentage', 'is_featured',
        'created_at', 'updated_at'
      ],
    });

    // Add counts and subscription info
    const testSeriesWithMeta = await Promise.all(
      rows.map(async (series) => {
        const categories_count = await Category.count({
          where: { test_series_id: series.id, is_active: true }
        });

        const tests_count = await Test.count({
          include: [{
            model: SubCategory,
            as: 'subCategory',
            include: [{
              model: Category,
              as: 'category',
              where: { test_series_id: series.id }
            }]
          }]
        });

        // Check subscription status if user is authenticated
        let is_subscribed = false;
        if (req.user && series.pricing_type === 'paid') {
          const subscription = await Subscription.findOne({
            where: {
              user_id: req.user.uuid,
              test_series_id: series.id,
              status: 'completed',
              [Sequelize.Op.or]: [
                { expiry_date: null },
                { expiry_date: { [Sequelize.Op.gt]: new Date() } }
              ]
            }
          });
          is_subscribed = !!subscription;
        }

        return {
          ...series.toJSON(),
          categories_count,
          tests_count,
          is_subscribed
        };
      })
    );

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

    // Add counts
    const categories_count = await Category.count({
      where: { test_series_id: testSeries.id, is_active: true }
    });

    const tests_count = await Test.count({
      include: [{
        model: SubCategory,
        as: 'subCategory',
        include: [{
          model: Category,
          as: 'category',
          where: { test_series_id: testSeries.id }
        }]
      }]
    });

    res.json({
      success: true,
      data: {
        ...testSeries.toJSON(),
        categories_count,
        tests_count
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

// Get single test series by ID (for mobile app compatibility)
router.get('/test-series/by-id/:id', optionalAuth, async (req, res) => {
  try {
    const testSeries = await TestSeries.findOne({
      where: { id: req.params.id, is_active: true }
    });

    if (!testSeries) {
      return res.status(404).json({
        success: false,
        message: 'Test series not found'
      });
    }

    // Add counts
    const categories_count = await Category.count({
      where: { test_series_id: testSeries.id, is_active: true }
    });

    const tests_count = await Test.count({
      include: [{
        model: SubCategory,
        as: 'subCategory',
        include: [{
          model: Category,
          as: 'category',
          where: { test_series_id: testSeries.id }
        }]
      }]
    });

    // Check subscription status if user is authenticated
    let is_subscribed = false;
    if (req.user && testSeries.pricing_type === 'paid') {
      const subscription = await Subscription.findOne({
        where: {
          user_id: req.user.uuid,
          test_series_id: testSeries.id,
          status: 'completed',
          [Sequelize.Op.or]: [
            { expiry_date: null },
            { expiry_date: { [Sequelize.Op.gt]: new Date() } }
          ]
        }
      });
      is_subscribed = !!subscription;
    }

    // Get all tests for this test series
    let tests = [];
    try {
      // Get all categories for this test series
      const categories = await Category.findAll({
        where: { test_series_id: testSeries.id, is_active: true }
      });
      
      if (categories.length > 0) {
        // Get subcategories for these categories
        const categoryIds = categories.map(c => c.id);
        const subCategories = await SubCategory.findAll({
          where: { category_id: categoryIds, is_active: true }
        });
        
        if (subCategories.length > 0) {
          // Get tests for these subcategories
          const subCategoryIds = subCategories.map(sc => sc.id);
          const rawTests = await Test.findAll({
            where: { 
              sub_category_id: subCategoryIds,
              is_active: true 
            },
            include: [{
              model: SubCategory,
              as: 'subCategory',
              include: [{
                model: Category,
                as: 'category'
              }]
            }]
          });

          // Add metadata to each test
          tests = await Promise.all(
            rawTests.map(async (test) => {
              const questions_count = await Question.count({
                where: { test_id: test.id, is_active: true }
              });

              let user_attempts = 0;
              let best_score = null;
              if (req.user) {
                const completedSessions = await TestSession.findAll({
                  where: { 
                    user_id: req.user.id,
                    test_id: test.id,
                    status: 'completed'
                  }
                });
                user_attempts = completedSessions.length;
                
                if (completedSessions.length > 0) {
                  best_score = 85; // Placeholder - implement actual score calculation
                }
              }

              // Check if test is locked
              let is_locked = false;
              if (testSeries.pricing_type === 'paid' && !is_subscribed) {
                is_locked = !test.is_free;
              }

              return {
                id: test.id,
                uuid: test.uuid,
                title: test.title,
                description: test.description,
                duration: test.duration_minutes,
                total_questions: questions_count,
                marks_per_question: test.marks_per_question || 1,
                negative_marks: test.negative_marks || 0,
                difficulty: test.difficulty_level,
                is_free: test.is_free || false,
                is_active: test.is_active,
                user_attempts: user_attempts,
                best_score: best_score,
                is_locked: is_locked,
                category: test.subCategory?.category?.name || 'General',
                sub_category: test.subCategory?.name || 'General'
              };
            })
          );
        }
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
      // Continue without tests rather than failing the whole request
    }

    res.json({
      success: true,
      data: {
        ...testSeries.toJSON(),
        categories_count,
        tests_count,
        is_subscribed,
        tests // Include tests in the response
      }
    });
  } catch (error) {
    console.error('Error fetching test series by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test series',
      error: error.message
    });
  }
});

// Get all tests for a test series by ID (for mobile app compatibility)
router.get('/test-series/by-id/:id/tests', optionalAuth, async (req, res) => {
  try {
    // console.log('📊 Getting tests for test series ID:', req.params.id);
    
    const testSeries = await TestSeries.findOne({
      where: { id: req.params.id, is_active: true }
    });

    if (!testSeries) {
      return res.status(404).json({
        success: false,
        message: 'Test series not found'
      });
    }

    // console.log('✅ Found test series:', testSeries.name);

    // Get all tests in this test series through the hierarchy
    let tests = [];
    try {
      // Alternative approach: Get tests directly with joins
      // console.log('🔍 Fetching tests for test series ID:', testSeries.id);
      
      // Use raw SQL to avoid association issues
      const query = `
        SELECT 
          t.*,
          sc.name as sub_category_name,
          c.name as category_name
        FROM tests t
        INNER JOIN sub_categories sc ON t.sub_category_id = sc.id
        INNER JOIN categories c ON sc.category_id = c.id
        WHERE c.test_series_id = :testSeriesId
          AND t.is_active = true
          AND sc.is_active = true
          AND c.is_active = true
        ORDER BY t.created_at ASC
      `;
      
      const rawTests = await sequelize.query(query, {
        replacements: { testSeriesId: testSeries.id },
        type: Sequelize.QueryTypes.SELECT
      });
      
      // console.log('📝 Found tests:', rawTests.length);
      
      // Transform raw results to match expected format
      tests = rawTests;
      
    } catch (queryError) {
      console.error('❌ Query error:', queryError.message);
      console.error('Full error:', queryError);
      
      // Fallback to simpler query
      try {
        // console.log('🔄 Trying fallback query...');
        
        // Just get categories first
        const categories = await Category.findAll({
          where: { test_series_id: testSeries.id, is_active: true }
        });
        
        // console.log('📁 Found categories:', categories.length);
        
        if (categories.length > 0) {
          // Get subcategories for these categories
          const categoryIds = categories.map(c => c.id);
          const subCategories = await SubCategory.findAll({
            where: { category_id: categoryIds, is_active: true }
          });
          
          // console.log('📂 Found subcategories:', subCategories.length);
          
          if (subCategories.length > 0) {
            // Get tests for these subcategories
            const subCategoryIds = subCategories.map(sc => sc.id);
            tests = await Test.findAll({
              where: { 
                sub_category_id: subCategoryIds,
                is_active: true 
              }
            });
            
            // console.log('✅ Found tests:', tests.length);
          }
        }
      } catch (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError.message);
        tests = [];
      }
    }

    // Add metadata and user-specific information
    const testsWithMeta = await Promise.all(
      tests.map(async (test) => {
        const questions_count = await Question.count({
          where: { test_id: test.id, is_active: true }
        });

        let user_attempts = 0;
        let best_score = null;
        if (req.user) {
          const completedSessions = await TestSession.findAll({
            where: { 
              user_id: req.user.id,
              test_id: test.id,
              status: 'completed'
            }
          });
          user_attempts = completedSessions.length;
          
          // Calculate best score if there are attempts
          if (completedSessions.length > 0) {
            // This would need actual score calculation logic
            // For now, just use a placeholder
            best_score = 85; // Placeholder
          }
        }

        // Check if test is locked based on test series subscription
        let is_locked = false;
        if (testSeries.pricing_type === 'paid' && req.user) {
          const subscription = await Subscription.findOne({
            where: {
              user_id: req.user.uuid,
              test_series_id: testSeries.id,
              status: 'completed',
              [Sequelize.Op.or]: [
                { expiry_date: null },
                { expiry_date: { [Sequelize.Op.gt]: new Date() } }
              ]
            }
          });
          is_locked = !subscription && !test.is_free;
        }

        return {
          id: test.id,
          uuid: test.uuid,
          title: test.title,
          description: test.description,
          duration: test.duration_minutes,
          total_questions: questions_count,
          marks_per_question: test.marks_per_question || 1,
          negative_marks: test.negative_marks || 0,
          difficulty: test.difficulty_level,
          is_free: test.is_free || false,
          is_active: test.is_active,
          user_attempts: user_attempts,
          best_score: best_score,
          is_locked: is_locked,
          category: test.subCategory?.category?.name || 'General',
          sub_category: test.subCategory?.name || 'General'
        };
      })
    );

    res.json({
      success: true,
      data: testsWithMeta
    });
  } catch (error) {
    console.error('Error fetching tests for test series by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tests',
      error: error.message
    });
  }
});

// Get all tests for a test series (flattened structure)
router.get('/test-series/:uuid/tests', optionalAuth, async (req, res) => {
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

    // Get all tests in this test series through the hierarchy
    const tests = await Test.findAll({
      include: [{
        model: SubCategory,
        as: 'subCategory',
        include: [{
          model: Category,
          as: 'category',
          where: { test_series_id: testSeries.id }
        }]
      }],
      where: { is_active: true },
      order: [['created_at', 'ASC']]
    });

    // Add metadata and user-specific information
    const testsWithMeta = await Promise.all(
      tests.map(async (test) => {
        const questions_count = await Question.count({
          where: { test_id: test.id, is_active: true }
        });

        let user_attempts = 0;
        let best_score = null;
        if (req.user) {
          const completedSessions = await TestSession.findAll({
            where: { 
              user_id: req.user.id,
              test_id: test.id,
              status: 'completed'
            }
          });
          user_attempts = completedSessions.length;
          
          // Calculate best score if there are attempts
          if (completedSessions.length > 0) {
            // This would need actual score calculation logic
            // For now, just use a placeholder
            best_score = 85; // Placeholder
          }
        }

        // Check if test is locked based on test series subscription
        let is_locked = false;
        if (testSeries.pricing_type === 'paid' && req.user) {
          const subscription = await Subscription.findOne({
            where: {
              user_id: req.user.uuid,
              test_series_id: testSeries.id,
              status: 'completed',
              [Sequelize.Op.or]: [
                { expiry_date: null },
                { expiry_date: { [Sequelize.Op.gt]: new Date() } }
              ]
            }
          });
          is_locked = !subscription && !test.is_free;
        }

        return {
          id: test.id,
          uuid: test.uuid,
          title: test.title,
          description: test.description,
          duration: test.duration_minutes,
          total_questions: questions_count,
          marks_per_question: test.marks_per_question || 1,
          negative_marks: test.negative_marks || 0,
          difficulty: test.difficulty_level,
          is_free: test.is_free || false,
          is_active: test.is_active,
          user_attempts: user_attempts,
          best_score: best_score,
          is_locked: is_locked,
          category: test.subCategory?.category?.name || 'General',
          sub_category: test.subCategory?.name || 'General'
        };
      })
    );

    res.json({
      success: true,
      data: testsWithMeta
    });
  } catch (error) {
    console.error('Error fetching tests for test series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tests',
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
            as: 'subCategory',
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

// Get questions for a test with proper access control
router.get('/tests/:uuid/questions', optionalAuth, async (req, res) => {
  try {
    // console.log('🔍 Getting questions for test:', req.params.uuid);
    
    // Find the test with its test series to check pricing
    const test = await Test.findOne({
      where: { uuid: req.params.uuid, is_active: true },
      include: [{
        model: TestSeries,
        as: 'testSeries',
        attributes: ['id', 'uuid', 'pricing_type', 'name']
      }]
    });

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    // Check if test belongs to a paid series and requires access control
    if (test.testSeries && test.testSeries.pricing_type === 'paid') {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access paid content',
          requiresAuth: true
        });
      }

      // Use our subscription access check logic
      const accessCheck = await checkUserTestSeriesAccess(req.user.uuid, test.testSeries.id);
      
      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Subscription required to access this content. Please purchase a subscription to continue.',
          errorCode: 'ACCESS_DENIED',
          accessRequired: true,
          testSeriesId: test.testSeries.id,
          testSeriesName: test.testSeries.name,
          reason: accessCheck.reason
        });
      }
    }

    const questionsRaw = await Question.findAll({
      where: { 
        test_id: test.id,
        is_active: true 
      },
      order: [['id', 'ASC']],
      attributes: [
        'id', 'uuid', 'question_text', 
        'option_a', 'option_b', 'option_c', 'option_d',
        'marks', 'created_at'
        // Note: correct_answer and explanation are excluded for security
      ]
    });

    // Add default values for fields that may not exist in database
    const questions = questionsRaw.map(q => ({
      ...q.toJSON(),
      difficulty: 'medium',  // Default difficulty
      subject: 'General'     // Default subject
    }));

    res.json({
      success: true,
      data: {
        questions,
        test_info: {
          id: test.id,
          uuid: test.uuid,
          title: test.title,
          duration_minutes: test.duration_minutes,
          total_marks: test.total_marks,
          is_demo: false
        }
      }
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
          can_access_demo: true
        }
      });
    }

    // For paid test series, check subscription
    const subscription = await Subscription.findOne({
      where: {
        user_id: req.user.uuid,
        test_series_id: testSeries.id,
        status: 'completed',
        [Sequelize.Op.or]: [
          { expiry_date: null },
          { expiry_date: { [Sequelize.Op.gt]: new Date() } }
        ]
      }
    });

    if (subscription) {
      return res.json({
        success: true,
        data: {
          has_access: true,
          subscription_type: 'paid',
          expires_at: subscription.expiry_date,
          purchase_date: subscription.purchase_date,
          can_access_demo: true,
          demo_tests_remaining: 0
        }
      });
    }

    // No demo tests available - demo test feature removed
    res.json({
      success: true,
      data: {
        has_access: false,
        subscription_type: null,
        expires_at: null,
        can_access_demo: false
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

// Start a test session (requires authentication and subscription)
router.post('/tests/:uuid/start', requireAuth, async (req, res) => {
  try {
    // Find the test with its test series
    const test = await Test.findOne({
      where: { uuid: req.params.uuid, is_active: true },
      include: [{
        model: TestSeries,
        as: 'testSeries',
        attributes: ['id', 'uuid', 'name', 'pricing_type']
      }]
    });

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    // Check subscription access for paid test series
    if (test.testSeries && test.testSeries.pricing_type === 'paid') {
      const { checkUserTestSeriesAccess } = require('../SubscriptionRoutes/subscriptionAccess');
      const hasAccess = await checkUserTestSeriesAccess(req.user.id, test.testSeries.id);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Please subscribe to access this test.',
          requires_subscription: true,
          test_series_id: test.testSeries.uuid
        });
      }
    }

    // Check if user already has an active session for this test
    const existingSession = await TestSession.findOne({
      where: {
        user_id: req.user.id,
        test_id: test.id,
        status: ['active', 'paused']
      }
    });

    if (existingSession) {
      return res.json({
        success: true,
        data: {
          session_id: existingSession.id,
          status: existingSession.status,
          started_at: existingSession.started_at,
          time_remaining: existingSession.remaining_time_seconds,
          is_resuming: true
        }
      });
    }

    // Get total questions for this test
    const totalQuestions = await Question.count({
      where: { test_id: test.id, is_active: true }
    });

    // Create new test session
    const session = await TestSession.create({
      user_id: req.user.id,
      test_id: test.id,
      started_at: new Date(),
      status: 'active',
      remaining_time_seconds: test.duration_minutes * 60, // Convert to seconds
      total_questions: totalQuestions
    });

    res.json({
      success: true,
      data: {
        session_id: session.id,
        status: session.status,
        started_at: session.started_at,
        time_remaining: session.remaining_time_seconds,
        is_demo: false
      }
    });
  } catch (error) {
    console.error('Error starting test session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start test session',
      error: error.message
    });
  }
});

// Save answer for a test session
router.post('/test-sessions/:sessionUuid/answers', requireAuth, async (req, res) => {
  try {
    const { sessionUuid } = req.params;
    const { question_id, selected_option, time_spent, is_flagged } = req.body;

    // Find the session and verify it belongs to the user
    const session = await TestSession.findOne({
      where: {
        uuid: sessionUuid,
        user_id: req.user.id,
        status: ['in_progress', 'paused']
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Test session not found or inactive'
      });
    }

    // Create or update user answer
    const [userAnswer] = await UserAnswer.findOrCreate({
      where: {
        session_id: session.id,
        question_id: question_id
      },
      defaults: {
        user_id: req.user.id,
        session_id: session.id,
        question_id: question_id,
        selected_option: selected_option,
        time_spent: time_spent || 0,
        is_flagged: is_flagged || false
      }
    });

    // If already exists, update it
    if (userAnswer) {
      await userAnswer.update({
        selected_option: selected_option,
        time_spent: time_spent || 0,
        is_flagged: is_flagged || false
      });
    }

    res.json({
      success: true,
      message: 'Answer saved successfully'
    });
  } catch (error) {
    console.error('Error saving answer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save answer',
      error: error.message
    });
  }
});

// Pause test session
router.post('/test-sessions/:sessionUuid/pause', requireAuth, async (req, res) => {
  try {
    const { sessionUuid } = req.params;

    const session = await TestSession.findOne({
      where: {
        uuid: sessionUuid,
        user_id: req.user.id,
        status: 'in_progress'
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active test session not found'
      });
    }

    await session.update({
      status: 'paused',
      updated_at: new Date()
    });

    res.json({
      success: true,
      data: {
        status: 'paused',
        time_remaining: session.time_remaining,
        paused_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error pausing test session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause test session',
      error: error.message
    });
  }
});

// Resume test session
router.post('/test-sessions/:sessionUuid/resume', requireAuth, async (req, res) => {
  try {
    const { sessionUuid } = req.params;

    const session = await TestSession.findOne({
      where: {
        uuid: sessionUuid,
        user_id: req.user.id,
        status: 'paused'
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Paused test session not found'
      });
    }

    await session.update({
      status: 'in_progress',
      updated_at: new Date()
    });

    res.json({
      success: true,
      data: {
        status: 'in_progress',
        time_remaining: session.time_remaining,
        resumed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error resuming test session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume test session',
      error: error.message
    });
  }
});

// Test submission endpoint by test UUID (REAL IMPLEMENTATION)
router.post('/tests/:testUuid/submit', requireAuth, async (req, res) => {
  try {
    // console.log('🔍 Submit test by UUID - Test UUID:', req.params.testUuid);
    // console.log('🔍 User ID:', req.user.uuid);

    // Get the session UUID from the request body
    const sessionUuid = req.body.session_uuid || req.body.sessionId;

    if (!sessionUuid) {
      return res.status(400).json({
        success: false,
        message: 'Session UUID is required'
      });
    }

    // Call the TestResponseController.submitTest method which has the real logic
    const TestResponseController = require('../../controllers/TestResponseController');

    // Reformat request to match TestResponseController expectations
    const modifiedReq = {
      ...req,
      body: {
        ...req.body,
        testSessionId: sessionUuid
      }
    };

    // Call the real submission logic
    return await TestResponseController.submitTest(modifiedReq, res);

  } catch (error) {
    console.error('Error in test submit:', error);
    res.status(500).json({ success: false, message: 'Submit failed', error: error.message });
  }
});

// Get test session results with answers for review
// TEMPORARY: Using hardcoded user ID for testing
router.get('/test-sessions/:sessionUuid/review', async (req, res) => {
  try {
    const { sessionUuid } = req.params;
    
    // console.log('📚 Review API - Session UUID:', sessionUuid);
    
    // TEMPORARY: For testing, we'll get the user from the session itself
    const sessionCheck = await TestSession.findOne({
      where: { id: sessionUuid }
    });
    
    if (!sessionCheck) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    const userId = sessionCheck.user_id;
    // console.log('📚 Review API - Using user ID from session:', userId);
    
    // Find the session - first without status check to debug
    let session = await TestSession.findOne({
      where: {
        id: sessionUuid,
        user_id: userId
      }
    });

    // console.log('📚 Review API - Session found:', session ? `Yes (status: ${session.status})` : 'No');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Test session not found'
      });
    }

    // Check if session is completed
    if (session.status !== 'completed') {
      // console.log('⚠️ Review API - Session not completed, status:', session.status);
      // For now, allow review even if not completed (for testing)
    }

    // Fetch session with full details
    session = await TestSession.findOne({
      where: {
        id: sessionUuid,
        user_id: userId
      },
      include: [{
        model: Test,
        as: 'test',
        include: [{
          model: SubCategory,
          as: 'subCategory',
          include: [{
            model: Category,
            as: 'category'
          }]
        }]
      }]
    });

    // Get all questions with user answers
    // console.log('📚 Review API - Getting questions for test_id:', session.test_id);
    // console.log('📚 Review API - Question model available:', !!Question);
    
    if (!Question) {
      throw new Error('Question model is not available');
    }
    
    const questions = await Question.findAll({
      where: {
        test_id: session.test_id,
        is_active: true
      },
      raw: true,
      order: [['id', 'ASC']]
    });

    // Get user answers for this session
    // console.log('📚 Review API - Getting user answers for session:', session.id);
    const userAnswers = await UserAnswer.findAll({
      where: {
        test_session_id: session.id
      },
      raw: true
    });
    // console.log('📚 Review API - Found user answers:', userAnswers.length);

    // Create answer map for quick lookup
    const answerMap = {};
    userAnswers.forEach(answer => {
      answerMap[answer.question_id] = answer;
    });

    // Format questions with user answers
    const questionsWithAnswers = questions.map(question => {
      const userAnswer = answerMap[question.id];
      const optionLetters = ['A', 'B', 'C', 'D'];
      
      // Use the correct field names from database
      const questionText = question.question_text;
      const correctAnswer = question.correct_answer;
      
      // Format options based on the model structure
      let formattedOptions;
      if (question.options) {
        // New format with JSON options
        formattedOptions = question.options;
      } else {
        // Old format with separate option columns
        formattedOptions = {
          A: question.option_a,
          B: question.option_b,
          C: question.option_c,
          D: question.option_d
        };
      }
      
      return {
        id: question.id,
        question_text: questionText,
        options: formattedOptions,
        correct_option: correctAnswer,
        selected_option: userAnswer ? userAnswer.selected_option : null,
        is_correct: userAnswer ? userAnswer.selected_option === correctAnswer : false,
        time_spent: userAnswer ? userAnswer.time_spent : 0,
        is_flagged: userAnswer ? userAnswer.is_flagged : false,
        explanation: question.explanation || 'No explanation available',
        marks: question.marks || 1
      };
    });

    // Calculate summary statistics
    const totalQuestions = questions.length;
    const attemptedQuestions = questionsWithAnswers.filter(q => q.selected_option !== null).length;
    const correctAnswers = questionsWithAnswers.filter(q => q.is_correct).length;
    const incorrectAnswers = attemptedQuestions - correctAnswers;
    const unansweredQuestions = totalQuestions - attemptedQuestions;
    const totalMarks = session.test.total_marks || totalQuestions;
    const marksPerQuestion = session.test.marks_per_question || 1;
    const negativeMarks = session.test.negative_marks || 0;
    
    // Calculate score
    const positiveScore = correctAnswers * marksPerQuestion;
    const negativeScore = incorrectAnswers * negativeMarks;
    const totalScore = positiveScore - negativeScore;
    const percentage = (totalScore / totalMarks) * 100;
    
    // Calculate time taken
    let timeTaken = 0;
    if (session.started_at && session.completed_at) {
      timeTaken = Math.floor((new Date(session.completed_at) - new Date(session.started_at)) / 1000);
    }

    res.json({
      success: true,
      data: {
        session_id: session.id,
        test_title: session.test.title,
        questions: questionsWithAnswers,
        result_summary: {
          total_questions: totalQuestions,
          attempted: attemptedQuestions,
          correct: correctAnswers,
          incorrect: incorrectAnswers,
          unanswered: unansweredQuestions,
          total_score: totalScore,
          total_marks: totalMarks,
          percentage: percentage.toFixed(2),
          time_taken: timeTaken,
          completed_at: session.completed_at
        }
      }
    });
  } catch (error) {
    console.error('Error fetching test review:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test review',
      error: error.message,
      details: error.stack
    });
  }
});

// Submit test session (REAL IMPLEMENTATION)
router.post('/test-sessions/:sessionUuid/submit', requireAuth, async (req, res) => {
  try {
    // console.log('🔍 Submit test - Session UUID:', req.params.sessionUuid);
    // console.log('🔍 User ID:', req.user.uuid);

    // Call the TestResponseController.submitTest method which has the real logic
    const TestResponseController = require('../../controllers/TestResponseController');

    // Reformat request to match TestResponseController expectations
    const modifiedReq = {
      ...req,
      body: {
        ...req.body,
        testSessionId: req.params.sessionUuid
      }
    };

    // Call the real submission logic
    return await TestResponseController.submitTest(modifiedReq, res);

    // OLD MOCK CODE (removed)
    /*
    res.json({
      success: true,
      message: 'Test submitted successfully',
      data: {
        session_id: req.params.sessionUuid,
        total_score: 85,
        correct_answers: 8,
        wrong_answers: 2,
        unanswered: 0,
        percentage: 85,
        passed: true,
        time_taken: 300
      }
    });
    return;
    */

  } catch (error) {
    console.error('Error submitting test session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit test session',
      error: error.message
    });
  }
});

module.exports = router;