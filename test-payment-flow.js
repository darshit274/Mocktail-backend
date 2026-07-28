#!/usr/bin/env node

/**
 * Test script for Razorpay Payment Integration
 * This script tests the complete payment flow end-to-end
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  email: 'testuser@mocktail.com',
  password: 'testpassword123'
};

async function testPaymentFlow() {
  // console.log('🧪 Testing Complete Payment Flow\n');

  try {
    // Step 1: Login to get authentication token
    // console.log('📝 Step 1: Authenticating user...');
    const loginResponse = await axios.post(`${BASE_URL}/users/login`, TEST_USER);
    
    if (!loginResponse.data.success) {
      // console.log('❌ Login failed. Creating test user...');
      
      // Try to register the test user first
      const registerResponse = await axios.post(`${BASE_URL}/users/register`, {
        ...TEST_USER,
        name: 'Test User',
        phone: '9999999999'
      });
      
      if (registerResponse.data.success) {
        // console.log('✅ Test user created successfully');
        // console.log('📝 Logging in with new user...');
        
        const loginRetry = await axios.post(`${BASE_URL}/users/login`, TEST_USER);
        if (!loginRetry.data.success) {
          throw new Error('Failed to login even after registration');
        }
        token = loginRetry.data.token;
      } else {
        throw new Error('Failed to create test user');
      }
    } else {
      token = loginResponse.data.token;
    }
    
    // console.log('✅ Authentication successful');
    // console.log(`🎫 Token: ${token.substring(0, 20)}...`);

    // Step 2: Create payment order
    // console.log('\n💰 Step 2: Creating payment order...');
    const orderResponse = await axios.post(
      `${BASE_URL}/payments/create-order`,
      {
        testSeriesId: '2',
        planType: 'test_series'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!orderResponse.data.success) {
      throw new Error(`Order creation failed: ${orderResponse.data.message}`);
    }

    const orderData = orderResponse.data.data;
    // console.log('✅ Payment order created successfully');
    // console.log(`📄 Order ID: ${orderData.orderId}`);
    // console.log(`💵 Amount: ₹${orderData.amount / 100}`);

    // Step 3: Test checkout page
    // console.log('\n🌐 Step 3: Testing checkout page...');
    const checkoutUrl = `${BASE_URL}/payments/checkout/${orderData.orderId}?keyId=${orderData.keyId}&amount=${orderData.amount}&currency=${orderData.currency}&subscriptionId=${orderData.subscriptionId}&itemName=${encodeURIComponent(orderData.itemDetails.name)}`;
    
    const checkoutResponse = await axios.get(checkoutUrl);
    
    if (checkoutResponse.status === 200 && checkoutResponse.data.includes('MockTale Payment')) {
      // console.log('✅ Checkout page loads successfully');
      // console.log(`🔗 Checkout URL: ${checkoutUrl}`);
    } else {
      throw new Error('Checkout page failed to load properly');
    }

    // Success summary
    // console.log('\n🎉 PAYMENT FLOW TEST COMPLETED SUCCESSFULLY!');
    // console.log('\n📋 Test Results:');
    // console.log('✅ User authentication: WORKING');
    // console.log('✅ Payment order creation: WORKING');
    // console.log('✅ Checkout page rendering: WORKING');
    // console.log('✅ Razorpay integration: CONFIGURED');
    
    // console.log('\n🚀 Next Steps:');
    // console.log('1. Open the checkout URL in a browser to test payment UI');
    // console.log('2. Test payment completion flow in React Native app');
    // console.log('3. Verify payment verification webhook handling');
    
    // console.log(`\n🌐 Manual Test URL:\n${checkoutUrl}`);

  } catch (error) {
    console.error('❌ Payment Flow Test Failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testPaymentFlow();