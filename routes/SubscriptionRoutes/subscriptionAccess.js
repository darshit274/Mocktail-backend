const express = require('express');
const router = express.Router();
const { authToken } = require('../../utils/AuthToken');
const { User, TestSeries, Subscription, Pdfs, PdfCategory } = require('../../models');
const { Op } = require('sequelize');

/**
 * Subscription.metadata is a JSON column. Depending on how it was written
 * (raw object vs JSON.stringify), Sequelize's MySQL driver may give us back:
 *   1. a parsed object                  (normal case — write was object)
 *   2. a JSON string                    (write was JSON.stringify(...))
 *   3. a doubly-encoded JSON string     (write was JSON.stringify(...) and the
 *                                        driver wrapped it again)
 *   4. null / undefined                 (no metadata)
 *
 * Walk through up to two parse layers so every case lands on a plain object.
 */
const parseSubscriptionMetadata = (raw) => {
  if (raw == null) return {};
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (_) { return {}; }
  }
  if (typeof v === 'string') {
    // double-encoded — one more parse
    try { v = JSON.parse(v); } catch (_) { return {}; }
  }
  return v && typeof v === 'object' ? v : {};
};

// Simple test endpoint for mobile app connectivity
router.get('/test', authToken, (req, res) => {
  res.json({
    success: true,
    message: '📱 Mobile app successfully connected to backend!',
    user: {
      id: req.user.uuid.substring(0, 8),
      email: req.user.email
    },
    serverTime: new Date().toISOString(),
    backendIP: '192.168.1.2:3000'
  });
});

// Check user's subscription status for a specific test series
router.get('/test-series/:seriesId', authToken, async (req, res) => {
  try {
    const { seriesId } = req.params;
    const userId = req.user.uuid;

    // console.log('📱 [MOBILE APP] Checking subscription access:', {
//       userId: userId.substring(0, 8),
//       seriesId,
//       timestamp: new Date().toISOString()
//     });

    // First, get the test series details
    let testSeries = await TestSeries.findOne({
      where: { uuid: seriesId },
      attributes: ['id', 'uuid', 'name', 'price', 'pricing_type', 'currency']
    });

    // Fallback to ID lookup if UUID not found
    if (!testSeries && !isNaN(seriesId)) {
      testSeries = await TestSeries.findOne({
        where: { id: parseInt(seriesId) },
        attributes: ['id', 'uuid', 'name', 'price', 'pricing_type', 'currency']
      });
    }

    if (!testSeries) {
      return res.status(404).json({
        success: false,
        message: 'Test series not found'
      });
    }



    // If the series is free, user has access
    if (testSeries.pricing_type === 'free' || testSeries.pricing_type === 'previous_years_question_papers') {
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          accessType: 'free',
          canPurchase: false,
          showEnrollButton: false,
          testSeries: {
            id: testSeries.id,
            uuid: testSeries.uuid,
            name: testSeries.name,
            price: testSeries.price,
            pricing_type: testSeries.pricing_type
          }
        }
      });
    }

    // Check for active subscription
    const activeSubscription = await Subscription.findOne({
      where: {
        user_id: userId,
        test_series_id: testSeries.id,
        status: 'completed',
        [Op.or]: [
          { expiry_date: null },
          { expiry_date: { [Op.gt]: new Date() } }
        ]
      },
      attributes: ['id', 'purchase_date', 'expiry_date', 'amount_paid']
    });

    if (activeSubscription) {
      // console.log('✅ [MOBILE APP] User has active subscription:', {
//         subscriptionId: activeSubscription.id,
//         userId: userId.substring(0, 8),
//         seriesId,
//         seriesName: testSeries.name
//       });
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          accessType: 'subscription',
          canPurchase: false,
          showEnrollButton: false,
          subscription: {
            id: activeSubscription.id,
            purchaseDate: activeSubscription.purchase_date,
            expiryDate: activeSubscription.expiry_date,
            amountPaid: activeSubscription.amount_paid
          },
          testSeries: {
            id: testSeries.id,
            uuid: testSeries.uuid,
            name: testSeries.name,
            price: testSeries.price,
            pricing_type: testSeries.pricing_type
          }
        }
      });
    }

    // Check for pending payment
    const pendingSubscription = await Subscription.findOne({
      where: {
        user_id: userId,
        test_series_id: testSeries.id,
        status: 'pending'
      },
      attributes: ['id', 'transaction_id', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    const hasPendingPayment = pendingSubscription &&
      (new Date() - new Date(pendingSubscription.created_at)) < (30 * 60 * 1000); // 30 minutes

    // console.log('🚫 [MOBILE APP] User does not have access:', {
//       userId: userId.substring(0, 8),
//       seriesId,
//       seriesName: testSeries.name,
//       hasPendingPayment: !!hasPendingPayment,
//       seriesPrice: testSeries.price
//     });

    return res.json({
      success: true,
      data: {
        hasAccess: false,
        accessType: 'none',
        canPurchase: !hasPendingPayment,
        showEnrollButton: !hasPendingPayment,
        hasPendingPayment: !!hasPendingPayment,
        pendingPayment: hasPendingPayment ? {
          transactionId: pendingSubscription.transaction_id,
          createdAt: pendingSubscription.created_at
        } : null,
        testSeries: {
          id: testSeries.id,
          uuid: testSeries.uuid,
          name: testSeries.name,
          price: testSeries.price,
          pricing_type: testSeries.pricing_type
        }
      }
    });

  } catch (error) {
    console.error('❌ Error checking subscription access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription access',
      error: error.message
    });
  }
});

// ===== PDF CATEGORY ACCESS (category-level pricing, mirrors test series) =====

/** Walk up the pdf_categories tree to the root — pricing lives on the root only. */
async function resolveRootPdfCategory(category) {
  let node = category;
  while (node && node.parent_category_id !== null) {
    node = await PdfCategory.findByPk(node.parent_category_id, {
      attributes: ['id', 'uuid', 'name', 'parent_category_id', 'pricing_type', 'price', 'discount_percentage'],
    });
  }
  return node;
}

/** Find the user's active purchase of a root PDF category (metadata.pdf_category_uuid). */
async function findCategoryPurchase(userId, rootUuid) {
  const candidates = await Subscription.findAll({
    where: {
      user_id: userId,
      test_series_id: null,
      status: 'completed',
      [Op.or]: [
        { expiry_date: null },
        { expiry_date: { [Op.gt]: new Date() } }
      ]
    },
    attributes: ['id', 'purchase_date', 'expiry_date', 'amount_paid', 'metadata'],
  });
  return candidates.find((sub) => {
    const md = parseSubscriptionMetadata(sub.metadata);
    return md.pdf_category_uuid === rootUuid;
  }) || null;
}

// Check user's subscription status for a PDF category (whole-category purchase)
router.get('/pdf-category/:categoryUuid', authToken, async (req, res) => {
  try {
    const { categoryUuid } = req.params;
    const userId = req.user.uuid;

    const category = await PdfCategory.findOne({
      where: { uuid: categoryUuid },
      attributes: ['id', 'uuid', 'name', 'parent_category_id', 'pricing_type', 'price', 'discount_percentage'],
    });
    if (!category) {
      return res.status(404).json({ success: false, message: 'PDF category not found' });
    }

    const root = await resolveRootPdfCategory(category);
    const basePrice = parseFloat(root?.price || 0);
    const discountPercentage = parseFloat(root?.discount_percentage || 0);
    const discountedPrice = discountPercentage > 0
      ? basePrice * (1 - discountPercentage / 100)
      : basePrice;

    const categoryInfo = {
      id: root.id,
      uuid: root.uuid,
      name: root.name,
      pricing_type: root.pricing_type,
      price: basePrice,
      discount_percentage: discountPercentage,
      discounted_price: discountedPrice,
    };

    // Free → always accessible; restricted → never purchasable
    if (root.pricing_type === 'free') {
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          accessType: 'free',
          canPurchase: false,
          showEnrollButton: false,
          category: categoryInfo,
        }
      });
    }
    if (root.pricing_type === 'restricted') {
      return res.json({
        success: true,
        data: {
          hasAccess: false,
          accessType: 'restricted',
          canPurchase: false,
          showEnrollButton: false,
          category: categoryInfo,
        }
      });
    }

    const purchase = await findCategoryPurchase(userId, root.uuid);
    if (purchase) {
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          accessType: 'purchased',
          canPurchase: false,
          showEnrollButton: false,
          subscription: {
            id: purchase.id,
            purchaseDate: purchase.purchase_date,
            expiryDate: purchase.expiry_date,
            amountPaid: purchase.amount_paid,
          },
          category: categoryInfo,
        }
      });
    }

    return res.json({
      success: true,
      data: {
        hasAccess: false,
        accessType: 'none',
        canPurchase: true,
        showEnrollButton: true,
        category: categoryInfo,
      }
    });
  } catch (error) {
    console.error('❌ Error checking PDF category access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check PDF category access',
      error: error.message
    });
  }
});

// Check user's subscription status for a PDF
router.get('/pdf/:pdfId', authToken, async (req, res) => {
  try {
    const { pdfId } = req.params;
    const userId = req.user.uuid;

    // console.log('🔍 Checking PDF access:', { userId: userId.substring(0, 8), pdfId });

    // Get PDF details
    const pdf = await Pdfs.findOne({
      where: { id: pdfId },
      attributes: ['id', 'title', 'access_level', 'file_path', 'category_id']
    });

    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found'
      });
    }

    // If PDF is free, user has access
    if (pdf.access_level === 'free') {
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          accessType: 'free',
          canPurchase: false,
          showEnrollButton: false,
          pdf: {
            id: pdf.id,
            title: pdf.title,
            access_level: pdf.access_level
          }
        }
      });
    }

    // For premium PDFs, check if user has purchased this specific PDF
    // console.log('🔍 Looking for PDF subscription with query:', {
//       user_id: userId,
//       test_series_id: null,
//       status: 'completed',
//       pdf_id_search: pdfId
//     });

    // First, let's see what subscriptions exist for this user
    const allUserSubscriptions = await Subscription.findAll({
      where: { user_id: userId },
      attributes: ['id', 'user_id', 'test_series_id', 'status', 'metadata', 'amount_paid', 'created_at']
    });

    // console.log('📋 All user subscriptions:', allUserSubscriptions.map(sub => ({
//       id: sub.id,
//       test_series_id: sub.test_series_id,
//       status: sub.status,
//       metadata: sub.metadata,
//       amount_paid: sub.amount_paid
//     })));

    // PDF purchases have test_series_id = NULL and metadata.pdf_id = <pdfId>.
    // We deliberately do NOT filter by `metadata` here because JSON-column
    // operators (Op.not: null, Op.like) behave inconsistently across MySQL
    // versions; the JS filter below handles every shape.
    const allCompletedPDFSubscriptions = await Subscription.findAll({
      where: {
        user_id: userId,
        test_series_id: null,
        status: 'completed',
        [Op.or]: [
          { expiry_date: null },
          { expiry_date: { [Op.gt]: new Date() } }
        ]
      },
      attributes: ['id', 'purchase_date', 'expiry_date', 'amount_paid', 'metadata']
    });

    // console.log('🔍 Candidate PDF subscriptions:', allCompletedPDFSubscriptions.length);
    // Dump exact shape of metadata for every candidate so we can see what we got
    allCompletedPDFSubscriptions.forEach((sub) => {
      // console.log(`  sub ${sub.id}: metadata typeof=${typeof sub.metadata}`,
//         typeof sub.metadata === 'string'
//           ? `value="${sub.metadata.substring(0, 200)}${sub.metadata.length > 200 ? '...' : ''}"`
//           : `value=${JSON.stringify(sub.metadata)}`);
    });

    const pdfSubscription = allCompletedPDFSubscriptions.find((sub) => {
      const metadata = parseSubscriptionMetadata(sub.metadata);
      const storedPdfId = metadata && metadata.pdf_id;
      const matches = storedPdfId === pdfId;
      // console.log(`  → sub ${sub.id}: parsed pdf_id=${storedPdfId}, target=${pdfId}, match=${matches}`);
      return matches;
    });

    // console.log('🎯 PDF subscription query result:', pdfSubscription ? {
//       id: pdfSubscription.id,
//       metadata: pdfSubscription.metadata,
//       amount_paid: pdfSubscription.amount_paid
//     } : 'NOT FOUND');

    if (pdfSubscription) {
      // console.log('✅ User has purchased this PDF:', pdfSubscription.id);
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          accessType: 'purchased',
          canPurchase: false,
          showEnrollButton: false,
          subscription: {
            id: pdfSubscription.id,
            purchaseDate: pdfSubscription.purchase_date,
            expiryDate: pdfSubscription.expiry_date,
            amountPaid: pdfSubscription.amount_paid
          },
          pdf: {
            id: pdf.id,
            title: pdf.title,
            access_level: pdf.access_level
          }
        }
      });
    }

    // No individual purchase — check whether the user bought the whole
    // category this PDF lives in (category-level pricing flow).
    if (pdf.category_id) {
      const pdfCategory = await PdfCategory.findByPk(pdf.category_id, {
        attributes: ['id', 'uuid', 'name', 'parent_category_id', 'pricing_type', 'price', 'discount_percentage'],
      });
      if (pdfCategory) {
        const root = await resolveRootPdfCategory(pdfCategory);
        if (root) {
          if (root.pricing_type === 'free') {
            return res.json({
              success: true,
              data: {
                hasAccess: true,
                accessType: 'free',
                canPurchase: false,
                showEnrollButton: false,
                pdf: { id: pdf.id, title: pdf.title, access_level: pdf.access_level }
              }
            });
          }
          const categoryPurchase = await findCategoryPurchase(userId, root.uuid);
          if (categoryPurchase) {
            // console.log('✅ User has purchased the parent PDF category:', root.uuid);
            return res.json({
              success: true,
              data: {
                hasAccess: true,
                accessType: 'purchased',
                canPurchase: false,
                showEnrollButton: false,
                subscription: {
                  id: categoryPurchase.id,
                  purchaseDate: categoryPurchase.purchase_date,
                  expiryDate: categoryPurchase.expiry_date,
                  amountPaid: categoryPurchase.amount_paid,
                },
                pdf: { id: pdf.id, title: pdf.title, access_level: pdf.access_level }
              }
            });
          }
        }
      }
    }

    // console.log('🚫 User has not purchased this PDF');
    return res.json({
      success: true,
      data: {
        hasAccess: false,
        accessType: 'none',
        canPurchase: true,
        showEnrollButton: true,
        pdf: {
          id: pdf.id,
          title: pdf.title,
          access_level: pdf.access_level
        }
      }
    });

  } catch (error) {
    console.error('❌ Error checking PDF access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check PDF access',
      error: error.message
    });
  }
});

// Get all user's active subscriptions
router.get('/my-subscriptions', authToken, async (req, res) => {
  try {
    const userId = req.user.uuid;

    const activeSubscriptions = await Subscription.findAll({
      where: {
        user_id: userId,
        status: 'completed',
        [Op.or]: [
          { expiry_date: null },
          { expiry_date: { [Op.gt]: new Date() } }
        ]
      },
      include: [{
        model: TestSeries,
        as: 'testSeries',
        attributes: ['id', 'uuid', 'name', 'description']
      }],
      attributes: ['id', 'test_series_id', 'purchase_date', 'expiry_date', 'amount_paid', 'metadata'],
      order: [['purchase_date', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        subscriptions: activeSubscriptions,
        totalCount: activeSubscriptions.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
});

// Middleware to check test access before allowing test taking
const checkTestAccess = async (req, res, next) => {
  try {
    const userId = req.user?.uuid;
    const { testId, seriesId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    let testSeriesId = seriesId;

    // If we have testId but no seriesId, find the series from test
    if (testId && !seriesId) {
      const test = await Test.findOne({
        where: { id: testId },
        include: [{
          model: TestSeries,
          attributes: ['id', 'uuid', 'pricing_type']
        }]
      });

      if (test && test.TestSeries) {
        testSeriesId = test.TestSeries.uuid;
      }
    }

    if (!testSeriesId) {
      return res.status(400).json({
        success: false,
        message: 'Test series information missing'
      });
    }

    // Use our subscription check logic
    const accessCheck = await checkUserTestSeriesAccess(userId, testSeriesId);

    if (!accessCheck.hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Please purchase subscription to access this test.',
        accessRequired: true
      });
    }

    // Add access info to request for use in controllers
    req.userAccess = accessCheck;
    next();

  } catch (error) {
    console.error('❌ Access check middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify access',
      error: error.message
    });
  }
};

// Helper function to check user access (with category-level check)
async function checkUserTestSeriesAccess(userId, seriesId, categoryId = null) {
  try {
    // console.log('🔍 [SUBCATEGORY] Checking user access:', {
//       userId: userId.substring(0, 8),
//       seriesId,
//       categoryId: categoryId || 'N/A',
//       timestamp: new Date().toISOString()
//     });

    // If categoryId is provided, check if it's a free-in-paid category
    if (categoryId) {
      const { Category } = require('../../models');
      let category = await Category.findOne({
        where: { uuid: categoryId },
        attributes: ['id', 'uuid', 'is_free_in_paid_series', 'test_series_id']
      });

      if (!category && !isNaN(categoryId)) {
        category = await Category.findOne({
          where: { id: parseInt(categoryId) },
          attributes: ['id', 'uuid', 'is_free_in_paid_series', 'test_series_id']
        });
      }

      // If category is marked as free in paid series, grant access immediately
      if (category && category.is_free_in_paid_series) {
        // console.log('✅ [FREE-IN-PAID] Category is marked as free:', {
//           categoryId: category.uuid,
//           userId: userId.substring(0, 8)
//         });
        return { hasAccess: true, accessType: 'free_in_paid_series' };
      }
    }

    // Get test series
    let testSeries = await TestSeries.findOne({
      where: { uuid: seriesId },
      attributes: ['id', 'uuid', 'pricing_type']
    });

    if (!testSeries && !isNaN(seriesId)) {
      testSeries = await TestSeries.findOne({
        where: { id: parseInt(seriesId) },
        attributes: ['id', 'uuid', 'pricing_type']
      });
    }

    if (!testSeries) {
      return { hasAccess: false, reason: 'Test series not found' };
    }

    // Free series - always accessible
    if (testSeries.pricing_type === 'free') {
      return { hasAccess: true, accessType: 'free' };
    }

    // Check for active subscription
    const activeSubscription = await Subscription.findOne({
      where: {
        user_id: userId,
        test_series_id: testSeries.id,
        status: 'completed',
        [Op.or]: [
          { expiry_date: null },
          { expiry_date: { [Op.gt]: new Date() } }
        ]
      }
    });

    if (activeSubscription) {
      // console.log('✅ [SUBCATEGORY] User has access:', {
//         subscriptionId: activeSubscription.id,
//         userId: userId.substring(0, 8),
//         seriesId,
//         testSeriesId: testSeries.id
//       });
      return { hasAccess: true, accessType: 'subscription' };
    }

    // console.log('🚫 [SUBCATEGORY] User denied access:', {
//       userId: userId.substring(0, 8),
//       seriesId,
//       testSeriesId: testSeries.id,
//       reason: 'No active subscription'
//     });
    return { hasAccess: false, reason: 'No active subscription' };

  } catch (error) {
    console.error('❌ Error checking user access:', error);
    return { hasAccess: false, reason: 'Access check failed' };
  }
}

module.exports = {
  router,
  checkTestAccess,
  checkUserTestSeriesAccess
};