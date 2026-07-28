const express = require('express');
const router = express.Router();
const paymentCheckoutRouter = require('./paymentCheckout');

// Add checkout routes
router.use('/checkout', paymentCheckoutRouter);
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { authToken } = require('../../utils/AuthToken');
const { User, TestSeries, Subscription, Pdfs, PdfCategory } = require('../../models');
const { Op } = require('sequelize');
const {
  razorpayInstance,
  razorpayConfig,
  generateReceiptId,
  verifyPaymentSignature,
  verifyWebhookSignature
} = require('../../config/razorpay');

// Middleware for logging payment requests
const paymentLogger = (req, res, next) => {
  // console.log(`💰 Payment API: ${req.method} ${req.originalUrl}`);
  // console.log('📋 Request Body:', req.body);
  // console.log('🔑 Headers:', {
//     authorization: req.headers.authorization ? 'Present' : 'Missing',
//     contentType: req.headers['content-type'],
//     origin: req.headers.origin
//   });
  next();
};

router.use(paymentLogger);

// Create Razorpay Order
router.post('/create-order', authToken, async (req, res) => {
  try {
    // console.log('🚀 Payment order creation started');
    // console.log('👤 User:', req.user ? req.user.uuid : 'No user found');
    const { testSeriesId, pdfId, pdfCategoryId, planType = 'test_series' } = req.body;
    const userId = req.user.uuid;
    // console.log('📦 Parsed request data:', { testSeriesId, pdfId, pdfCategoryId, planType, userId });

    // Validate required fields
    if (!testSeriesId && !pdfId && !pdfCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Either testSeriesId, pdfId or pdfCategoryId is required'
      });
    }

    let itemDetails = null;
    let amount = 0;

    // Get item details and price
    if (planType === 'test_series' && testSeriesId) {
      // Try to find by UUID first, then by ID for backward compatibility
      itemDetails = await TestSeries.findOne({
        where: { uuid: testSeriesId },
        attributes: ['id', 'uuid', 'name', 'price', 'currency', 'pricing_type']
      });
      
      // If not found by UUID, try by ID (for backward compatibility)
      if (!itemDetails && !isNaN(testSeriesId)) {
        itemDetails = await TestSeries.findOne({
          where: { id: parseInt(testSeriesId) },
          attributes: ['id', 'uuid', 'name', 'price', 'currency', 'pricing_type']
        });
      }

      if (!itemDetails) {
        return res.status(404).json({
          success: false,
          message: 'Test series not found'
        });
      }

      if (itemDetails.pricing_type === 'free') {
        return res.status(400).json({
          success: false,
          message: 'This test series is free. No payment required.'
        });
      }

      amount = Math.round(parseFloat(itemDetails.price) * 100); // Convert to paise
    } else if ((planType === 'pdf' || planType === 'pdf_purchase') && pdfId) {
      // console.log('🔍 PDF Payment - Looking for PDF ID:', pdfId);

      itemDetails = await Pdfs.findOne({
        where: { id: pdfId },
        attributes: ['id', 'title', 'access_level', 'price', 'currency', 'is_free', 'discount_percentage']
      });

      // console.log('📄 PDF Details Retrieved:', itemDetails ? itemDetails.toJSON() : 'NOT FOUND');

      if (!itemDetails) {
        // console.log('❌ PDF not found in database for ID:', pdfId);
        return res.status(404).json({
          success: false,
          message: 'PDF not found'
        });
      }

      // console.log('🔒 PDF Access Check:', {
//         access_level: itemDetails.access_level,
//         is_free: itemDetails.is_free,
//         shouldBypassPayment: itemDetails.access_level === 'free' || itemDetails.is_free
//       });

      if (itemDetails.access_level === 'free' || itemDetails.is_free) {
        // console.log('🆓 PDF is free, rejecting payment');
        return res.status(400).json({
          success: false,
          message: 'This PDF is free. No payment required.'
        });
      }

      // Calculate amount from PDF price with discount
      const basePrice = parseFloat(itemDetails.price || 0);
      const discountPercentage = parseFloat(itemDetails.discount_percentage || 0);
      const discountedPrice = discountPercentage > 0
        ? basePrice * (1 - discountPercentage / 100)
        : basePrice;

      amount = Math.round(discountedPrice * 100); // Convert to paise

      // console.log('💰 DETAILED PDF pricing calculation:', {
//         pdfId,
//         title: itemDetails.title,
//         rawPrice: itemDetails.price,
//         rawPriceType: typeof itemDetails.price,
//         basePrice,
//         basePriceType: typeof basePrice,
//         discountPercentage,
//         discountedPrice,
//         discountedPriceType: typeof discountedPrice,
//         amountInPaise: amount,
//         amountInRupees: amount / 100,
//         finalAmountType: typeof amount,
//         isValidAmount: amount > 0 && Number.isInteger(amount)
//       });

      // Additional safety check
      if (!amount || amount <= 0 || !Number.isInteger(amount)) {
        // console.log('⚠️ AMOUNT CALCULATION FAILED - Details:', {
//           originalPrice: itemDetails.price,
//           parsedBasePrice: basePrice,
//           calculatedAmount: amount,
//           isNaN: isNaN(amount),
//           isInteger: Number.isInteger(amount)
//         });
      }
    } else if (planType === 'pdf_category' && pdfCategoryId) {
      // Whole PDF category purchase — pricing lives on the ROOT category
      // (same model as test series: one payment unlocks everything inside).
      // console.log('🔍 PDF Category Payment - Looking for category:', pdfCategoryId);

      itemDetails = await PdfCategory.findOne({
        where: { uuid: pdfCategoryId },
        attributes: ['id', 'uuid', 'name', 'parent_category_id', 'pricing_type', 'price', 'discount_percentage'],
      });

      if (!itemDetails) {
        return res.status(404).json({
          success: false,
          message: 'PDF category not found'
        });
      }

      if (itemDetails.parent_category_id !== null) {
        return res.status(400).json({
          success: false,
          message: 'Only main (root) PDF categories can be purchased'
        });
      }

      if (itemDetails.pricing_type !== 'paid') {
        return res.status(400).json({
          success: false,
          message: itemDetails.pricing_type === 'free'
            ? 'This PDF category is free. No payment required.'
            : 'This PDF category is not available for purchase.'
        });
      }

      const basePrice = parseFloat(itemDetails.price || 0);
      const discountPercentage = parseFloat(itemDetails.discount_percentage || 0);
      const discountedPrice = discountPercentage > 0
        ? basePrice * (1 - discountPercentage / 100)
        : basePrice;
      amount = Math.round(discountedPrice * 100); // paise

      // console.log('💰 PDF category pricing:', {
//         category: itemDetails.name,
//         basePrice,
//         discountPercentage,
//         discountedPrice,
//         amountInPaise: amount,
//       });

      // Duplicate purchase / pending payment guards (same as test series)
      const completedCategorySubs = await Subscription.findAll({
        where: {
          user_id: userId,
          test_series_id: null,
          status: 'completed',
          [Op.or]: [
            { expiry_date: null },
            { expiry_date: { [Op.gt]: new Date() } }
          ]
        },
        attributes: ['id', 'purchase_date', 'expiry_date', 'metadata'],
      });
      const alreadyOwned = completedCategorySubs.find((sub) => {
        const md = parseSubscriptionMetadata(sub.metadata);
        return md.pdf_category_uuid === itemDetails.uuid;
      });
      if (alreadyOwned) {
        return res.status(400).json({
          success: false,
          message: 'You already have access to this PDF category',
          errorCode: 'ALREADY_SUBSCRIBED',
          data: {
            subscriptionId: alreadyOwned.id,
            purchaseDate: alreadyOwned.purchase_date,
            expiryDate: alreadyOwned.expiry_date
          }
        });
      }

      const pendingCategorySubs = await Subscription.findAll({
        where: {
          user_id: userId,
          test_series_id: null,
          status: 'pending',
          created_at: { [Op.gt]: new Date(Date.now() - 5 * 60 * 1000) }
        },
        attributes: ['id', 'transaction_id', 'created_at', 'metadata'],
        order: [['created_at', 'DESC']],
      });
      const recentPending = pendingCategorySubs.find((sub) => {
        const md = parseSubscriptionMetadata(sub.metadata);
        return md.pdf_category_uuid === itemDetails.uuid;
      });
      if (recentPending) {
        return res.status(400).json({
          success: false,
          message: 'You have a recent pending payment for this PDF category. Please wait or complete the existing payment.',
          errorCode: 'PAYMENT_PENDING',
          data: {
            transactionId: recentPending.transaction_id,
            createdAt: recentPending.created_at
          }
        });
      }
    }

    // Validate amount thoroughly
    // console.log('💰 Amount validation:', { amount, type: typeof amount, isInteger: Number.isInteger(amount) });
    
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      // console.log('❌ Invalid amount detected:', { amount, type: typeof amount });
      return res.status(400).json({
        success: false,
        message: `Invalid amount for payment: ${amount}. Amount must be a positive integer in paise.`
      });
    }

    // Razorpay test mode has limits - check if amount is reasonable
    if (amount > 50000000) { // 5 lakh rupees in paise
      // console.log('❌ Amount too large for test mode:', amount);
      return res.status(400).json({
        success: false,
        message: 'Amount exceeds test mode limits'
      });
    }

    // Enhanced subscription check to prevent duplicate payments
    if (planType === 'test_series') {
      const { Op } = require('sequelize');
      
      // Check for existing completed subscription
      const existingSubscription = await Subscription.findOne({
        where: {
          user_id: userId,
          test_series_id: itemDetails.id,
          status: 'completed',
          [Op.or]: [
            { expiry_date: null },
            { expiry_date: { [Op.gt]: new Date() } }
          ]
        }
      });

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active subscription for this test series',
          errorCode: 'ALREADY_SUBSCRIBED',
          data: {
            subscriptionId: existingSubscription.id,
            purchaseDate: existingSubscription.purchase_date,
            expiryDate: existingSubscription.expiry_date
          }
        });
      }

      // Check for recent pending payment (within last 30 minutes)
      const recentPendingPayment = await Subscription.findOne({
        where: {
          user_id: userId,
          test_series_id: itemDetails.id,
          status: 'pending',
          created_at: {
            [Op.gt]: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago (reduced from 30)
          }
        },
        order: [['created_at', 'DESC']]
      });

      if (recentPendingPayment) {
        return res.status(400).json({
          success: false,
          message: 'You have a recent pending payment for this test series. Please wait or complete the existing payment.',
          errorCode: 'PAYMENT_PENDING',
          data: {
            transactionId: recentPendingPayment.transaction_id,
            createdAt: recentPendingPayment.created_at
          }
        });
      }
    }

    // Generate unique receipt ID
    const receiptId = generateReceiptId(planType.toUpperCase(), userId);

    // Create Razorpay order with validated parameters
    const orderOptions = {
      amount: parseInt(amount), // Ensure it's an integer
      currency: razorpayConfig.currency || 'INR',
      receipt: receiptId,
      payment_capture: 1, // Auto capture payments
      notes: {
        ...razorpayConfig.notes,
        user_id: userId.substring(0, 40), // Limit length for Razorpay
        plan_type: planType,
        item_id: (testSeriesId || pdfId || pdfCategoryId).toString().substring(0, 40),
        item_name: (itemDetails.name || itemDetails.title).substring(0, 50)
      }
    };

    // console.log('🔄 Creating Razorpay order with options:');
    // console.log('📋 Amount:', orderOptions.amount, '(', orderOptions.amount / 100, 'INR )');
    // console.log('🔖 Currency:', orderOptions.currency);
    // console.log('🧾 Receipt:', orderOptions.receipt);
    // console.log('📝 Notes:', JSON.stringify(orderOptions.notes, null, 2));

    const order = await razorpayInstance.orders.create(orderOptions);

    // console.log('✅ Razorpay order created:', order.id);

    // Create pending subscription record
    const subscriptionData = {
      id: uuidv4(),
      user_id: userId,
      test_series_id: planType === 'test_series' ? itemDetails.id : null,
      transaction_id: order.id,
      payment_method: 'razorpay',
      amount_paid: amount / 100, // Convert back to rupees
      currency: razorpayConfig.currency,
      status: 'pending',
      purchase_date: new Date(),
      expiry_date: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)), // 1 year from now
      // Pass a plain object — Sequelize handles JSON-column serialisation. Using
      // JSON.stringify(...) here can lead to MySQL storing a JSON string value
      // (instead of a JSON object), which then breaks metadata.pdf_id lookups.
      metadata: {
        plan_type: planType,
        pdf_id: pdfId || null,
        pdf_category_uuid: planType === 'pdf_category' ? itemDetails.uuid : null,
        pdf_category_id: planType === 'pdf_category' ? itemDetails.id : null,
        razorpay_order_id: order.id,
        receipt_id: receiptId
      }
    };

    await Subscription.create(subscriptionData);

    // console.log('✅ Pending subscription created:', subscriptionData.id);

    // Fetch user details for Razorpay prefill
    const userDetails = await User.findOne({
      where: { uuid: userId },
      attributes: ['username', 'email', 'fullName', 'phone', 'phoneNumber']
    });

    // Helper function to format phone number for Razorpay
    const formatPhoneNumber = (phone) => {
      if (!phone) return '+919999999999'; // Fallback for users without phone

      // Remove all non-digit characters except +
      let cleaned = phone.replace(/[^\d+]/g, '');

      // If already has country code, return as is
      if (cleaned.startsWith('+')) return cleaned;

      // If starts with 91, add +
      if (cleaned.startsWith('91') && cleaned.length === 12) {
        return `+${cleaned}`;
      }

      // If 10 digits, add +91 (Indian number)
      if (cleaned.length === 10) {
        return `+91${cleaned}`;
      }

      // Otherwise return fallback
      return '+919999999999';
    };

    // Prepare user info for prefill
    const userPhone = userDetails?.phone || userDetails?.phoneNumber;
    const userName = userDetails?.fullName || userDetails?.username || 'User';
    const userEmail = userDetails?.email || 'user@example.com';

    // console.log('📋 User details for Razorpay prefill:', {
//       name: userName,
//       email: userEmail,
//       phone: userPhone,
//       formattedPhone: formatPhoneNumber(userPhone)
//     });

    // Return order details to frontend
    res.json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: amount,
        currency: order.currency,
        receiptId: receiptId,
        keyId: process.env.RAZORPAY_KEY_ID,
        itemDetails: {
          name: itemDetails.name || itemDetails.title,
          type: planType,
          price: amount / 100
        },
        subscriptionId: subscriptionData.id,
        // Include user details for Razorpay prefill
        userDetails: {
          name: userName,
          email: userEmail,
          contact: formatPhoneNumber(userPhone)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating payment order:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.error?.code);
    console.error('Error description:', error.error?.description);
    console.error('Full error object:', JSON.stringify(error.error || error, null, 2));
    
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message || 'Unknown error occurred',
      details: error.error || {}
    });
  }
});

// Verify Payment
/**
 * Subscription.metadata is a JSON column. Depending on how a row was originally
 * written (older code used JSON.stringify(...)), the value coming back from
 * Sequelize may be:
 *   1. a plain JS object
 *   2. a JSON string
 *   3. a doubly-encoded JSON string
 *   4. null / undefined
 * Walk through up to two parse layers so every case lands on a plain object.
 */
const parseSubscriptionMetadata = (raw) => {
  if (raw == null) return {};
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (_) { return {}; }
  }
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (_) { return {}; }
  }
  return v && typeof v === 'object' ? v : {};
};

router.post('/verify-payment', authToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      subscription_id
    } = req.body;
    const userId = req.user.uuid;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters'
      });
    }

    // Verify payment signature
    const isValidSignature = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      // console.log('❌ Invalid payment signature:', {
//         orderId: razorpay_order_id,
//         paymentId: razorpay_payment_id,
//         signature: razorpay_signature
//       });

      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Find pending subscription
    const subscription = await Subscription.findOne({
      where: {
        id: subscription_id || undefined,
        user_id: userId,
        transaction_id: razorpay_order_id,
        status: 'pending'
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or already processed'
      });
    }

    // Verify payment with Razorpay API
    try {
      const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);
      
      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        return res.status(400).json({
          success: false,
          message: `Payment not successful. Status: ${payment.status}`
        });
      }

      if (payment.order_id !== razorpay_order_id) {
        return res.status(400).json({
          success: false,
          message: 'Payment order mismatch'
        });
      }

      // Build the metadata we want to persist
      const mergedMetadata = {
        ...parseSubscriptionMetadata(subscription.metadata),
        razorpay_payment_id: razorpay_payment_id,
        payment_status: payment.status,
        payment_method: payment.method,
        verified_at: new Date().toISOString()
      };
      // console.log('💾 Writing merged metadata:', JSON.stringify(mergedMetadata));

      // Update subscription status — pass plain objects so Sequelize handles the JSON serialisation
      await subscription.update({
        status: 'completed',
        metadata: mergedMetadata
      });

      // Re-read straight from DB so we can SEE what actually got persisted
      const verifyPersisted = await Subscription.findOne({
        where: { id: subscription.id },
        attributes: ['id', 'status', 'metadata', 'test_series_id', 'expiry_date']
      });
      // console.log('🔍 Persisted subscription:', {
//         id: verifyPersisted?.id,
//         status: verifyPersisted?.status,
//         test_series_id: verifyPersisted?.test_series_id,
//         expiry_date: verifyPersisted?.expiry_date,
//         metadata_typeof: typeof verifyPersisted?.metadata,
//         metadata: typeof verifyPersisted?.metadata === 'string'
//           ? verifyPersisted.metadata
//           : JSON.stringify(verifyPersisted?.metadata)
//       });

      // Update user subscription status
      await User.update({
        subscription_status: 'active',
        total_subscriptions: require('sequelize').literal('total_subscriptions + 1')
      }, {
        where: { uuid: userId }
      });

      // console.log('✅ Payment verified and subscription activated:', {
//         subscriptionId: subscription.id,
//         paymentId: razorpay_payment_id,
//         amount: payment.amount / 100
//       });

      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          subscriptionId: subscription.id,
          paymentId: razorpay_payment_id,
          amount: payment.amount / 100,
          status: 'completed',
          expiryDate: subscription.expiry_date
        }
      });

    } catch (razorpayError) {
      console.error('❌ Razorpay payment verification failed:', razorpayError);
      
      // Update subscription status to failed
      await subscription.update({
        status: 'failed',
        metadata: {
          ...parseSubscriptionMetadata(subscription.metadata),
          error: razorpayError.message,
          failed_at: new Date().toISOString()
        }
      });

      res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: 'Unable to verify payment with Razorpay'
      });
    }

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
});

// Webhook handler for Razorpay events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    // console.log('🔔 Razorpay webhook received:', {
//       signature: signature ? 'present' : 'missing',
//       bodyLength: body.length
//     });

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      // console.log('❌ Invalid webhook signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = JSON.parse(body.toString());
    // console.log('📨 Webhook event:', event.event);

    // Handle different webhook events
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload);
        break;
        
      case 'payment.failed':
        await handlePaymentFailed(event.payload);
        break;
        
      case 'order.paid':
        await handleOrderPaid(event.payload);
        break;
        
      default:
        // console.log('🔔 Unhandled webhook event:', event.event);
    }

    res.json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

// Get Payment Status
router.get('/status/:orderId', authToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.uuid;

    // Find subscription by order ID
    const subscription = await Subscription.findOne({
      where: {
        user_id: userId,
        transaction_id: orderId
      },
      include: [{
        model: TestSeries,
        as: 'testSeries',
        attributes: ['name', 'uuid']
      }]
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Payment order not found'
      });
    }

    // Get payment details from Razorpay if available
    let paymentDetails = null;
    if (subscription.status === 'completed') {
      try {
        const metadata = parseSubscriptionMetadata(subscription.metadata);
        if (metadata.razorpay_payment_id) {
          paymentDetails = await razorpayInstance.payments.fetch(metadata.razorpay_payment_id);
        }
      } catch (error) {
        // console.log('Could not fetch payment details:', error.message);
      }
    }

    res.json({
      success: true,
      data: {
        orderId: subscription.transaction_id,
        subscriptionId: subscription.id,
        status: subscription.status,
        amount: subscription.amount_paid,
        currency: subscription.currency,
        purchaseDate: subscription.purchase_date,
        expiryDate: subscription.expiry_date,
        paymentDetails: paymentDetails ? {
          paymentId: paymentDetails.id,
          method: paymentDetails.method,
          status: paymentDetails.status
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Error fetching payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment status',
      error: error.message
    });
  }
});

// Helper functions for webhook event handling
async function handlePaymentCaptured(payload) {
  try {
    const payment = payload.payment.entity;
    // console.log('✅ Payment captured:', payment.id);

    // Update subscription if exists
    await Subscription.update({
      status: 'completed',
      metadata: require('sequelize').literal(`JSON_SET(COALESCE(metadata, '{}'), '$.webhook_captured_at', '${new Date().toISOString()}')`)
    }, {
      where: {
        transaction_id: payment.order_id,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
}

async function handlePaymentFailed(payload) {
  try {
    const payment = payload.payment.entity;
    // console.log('❌ Payment failed:', payment.id);

    // Update subscription status
    await Subscription.update({
      status: 'failed',
      metadata: require('sequelize').literal(`JSON_SET(COALESCE(metadata, '{}'), '$.webhook_failed_at', '${new Date().toISOString()}')`)
    }, {
      where: {
        transaction_id: payment.order_id,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleOrderPaid(payload) {
  try {
    const order = payload.order.entity;
    // console.log('💰 Order paid:', order.id);

    // Additional processing if needed
    
  } catch (error) {
    console.error('Error handling order paid:', error);
  }
}

// ADMIN/TESTING: Clean up old pending payments (older than 30 minutes)
router.delete('/cleanup-pending', authToken, async (req, res) => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find old pending payments
    const oldPendingPayments = await Subscription.findAll({
      where: {
        status: 'pending',
        created_at: {
          [Op.lt]: thirtyMinutesAgo
        }
      },
      attributes: ['id', 'transaction_id', 'user_id', 'created_at', 'amount_paid']
    });

    // console.log(`🧹 Found ${oldPendingPayments.length} old pending payments to clean up`);

    // Delete old pending payments
    const deletedCount = await Subscription.destroy({
      where: {
        status: 'pending',
        created_at: {
          [Op.lt]: thirtyMinutesAgo
        }
      }
    });

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old pending payments`,
      data: {
        deletedCount,
        cutoffTime: thirtyMinutesAgo,
        cleanedPayments: oldPendingPayments.map(p => ({
          id: p.id,
          transaction_id: p.transaction_id,
          created_at: p.created_at,
          amount: p.amount_paid
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error cleaning up pending payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up pending payments',
      error: error.message
    });
  }
});

module.exports = router;