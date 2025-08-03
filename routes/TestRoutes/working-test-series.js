const express = require('express');
const router = express.Router();
const { sequelize } = require('../../models');
const AuthToken = require('../../utils/AuthToken');

// Simple middleware for optional auth
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = AuthToken.verifyToken(token);
      req.user = { id: decoded.userId };
    }
    next();
  } catch (error) {
    next(); // Continue without auth for public endpoints
  }
};

// Get all test series using raw queries to avoid model issues
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
    
    // Build WHERE conditions
    let whereConditions = ['is_active = 1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR name_gujarati LIKE ? OR description LIKE ? OR description_gujarati LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (pricing_type) {
      whereConditions.push('pricing_type = ?');
      queryParams.push(pricing_type);
    }

    if (is_featured !== undefined) {
      whereConditions.push('is_featured = ?');
      queryParams.push(is_featured === 'true' ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM new_test_series ${whereClause}`;
    const [countResult] = await sequelize.query(countQuery, {
      replacements: queryParams,
      type: sequelize.QueryTypes.SELECT
    });
    const total = countResult.total;

    // Get paginated results
    const dataQuery = `
      SELECT 
        id, uuid, name, name_gujarati, description, description_gujarati,
        is_active, pricing_type, price, currency, demo_tests_count,
        subscription_duration_days, discount_percentage, is_featured,
        created_at, updated_at
      FROM new_test_series 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const results = await sequelize.query(dataQuery, {
      replacements: [...queryParams, parseInt(limit), parseInt(offset)],
      type: sequelize.QueryTypes.SELECT
    });

    // Add metadata for each test series
    const testSeriesWithMeta = results.map(series => ({
      ...series,
      categories_count: 0, // Placeholder - will implement when we have proper associations
      tests_count: 0, // Placeholder - will implement when we have proper associations
      is_subscribed: false // Placeholder - will implement subscription logic
    }));

    res.json({
      success: true,
      data: testSeriesWithMeta,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
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
    const query = `
      SELECT 
        id, uuid, name, name_gujarati, description, description_gujarati,
        is_active, pricing_type, price, currency, demo_tests_count,
        subscription_duration_days, discount_percentage, is_featured,
        created_at, updated_at
      FROM new_test_series 
      WHERE uuid = ? AND is_active = 1
    `;
    
    const [testSeries] = await sequelize.query(query, {
      replacements: [req.params.uuid],
      type: sequelize.QueryTypes.SELECT
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
        ...testSeries,
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

// Check subscription access
router.get('/test-series/:uuid/subscription-access', optionalAuth, async (req, res) => {
  try {
    const query = `
      SELECT pricing_type, demo_tests_count 
      FROM new_test_series 
      WHERE uuid = ? AND is_active = 1
    `;
    
    const [testSeries] = await sequelize.query(query, {
      replacements: [req.params.uuid],
      type: sequelize.QueryTypes.SELECT
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

    // For paid test series, return demo access for now
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