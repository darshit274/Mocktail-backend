const Razorpay = require('razorpay');

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Razorpay configuration
const razorpayConfig = {
  currency: 'INR',
  receipt_prefix: 'MOCKTAIL_',
  webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
  
  // Payment options
  payment_capture: 1, // Auto capture payments
  notes: {
    app_name: 'Mocktail',
    version: '1.0.0'
  }
};

// Validate Razorpay configuration
const validateConfig = () => {
  if (!process.env.RAZORPAY_KEY_ID) {
    throw new Error('RAZORPAY_KEY_ID is required in environment variables');
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_SECRET is required in environment variables');
  }
  // console.log('✅ Razorpay configuration validated successfully');
};

// Generate unique receipt ID (Razorpay limit: 40 chars)
const generateReceiptId = (type = 'SUB', userId = '') => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 chars
  const userSuffix = userId.slice(-4); // Last 4 chars of user ID
  const receiptId = `MT_${type}_${userSuffix}_${timestamp}_${randomStr}`;
  
  // Ensure it's within Razorpay's 40 character limit
  // console.log('🧾 Generated receipt ID:', receiptId, 'Length:', receiptId.length);
  return receiptId.substring(0, 40);
};

// Verify payment signature
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const crypto = require('crypto');
  const body = orderId + '|' + paymentId;
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
    
  return expectedSignature === signature;
};

// Verify webhook signature
const verifyWebhookSignature = (body, signature) => {
  const crypto = require('crypto');
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
    
  return expectedSignature === signature;
};

module.exports = {
  razorpayInstance,
  razorpayConfig,
  validateConfig,
  generateReceiptId,
  verifyPaymentSignature,
  verifyWebhookSignature
};