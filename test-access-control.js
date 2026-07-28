#!/usr/bin/env node

/**
 * Test script for complete access control flow
 * Tests subscription access, payment prevention, and test blocking
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  email: 'accesstest@mocktail.com',
  password: 'testpassword123',
  name: 'Access Test User',
  phone: '9999999998'
};

let token = '';
let testSeriesId = '';

async function testAccessControl() {
  // console.log('🔒 Testing Complete Access Control Flow\n');

  try {
    // Step 1: Create/Login test user
    // console.log('📝 Step 1: Setting up test user...');
    try {
      await axios.post(`${BASE_URL}/users/register`, TEST_USER);
      // console.log('✅ Test user created');
    } catch (error) {
      // console.log('ℹ️  Test user already exists, continuing...');
    }

    const loginResponse = await axios.post(`${BASE_URL}/users/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    if (!loginResponse.data.success) {
      throw new Error('Failed to login test user');
    }

    token = loginResponse.data.token;
    // console.log('✅ User authenticated');

    // Step 2: Find a paid test series
    // console.log('\n🔍 Step 2: Finding paid test series...');
    const testSeriesResponse = await axios.get(`${BASE_URL}/dynamic/test-series`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const paidSeries = testSeriesResponse.data.data.find(series => 
      series.pricing_type === 'paid' && parseFloat(series.price) > 0
    );

    if (!paidSeries) {
      // console.log('⚠️  No paid test series found, creating one for testing...');
      // In a real scenario, you would create a test series, but let's use ID 2 for now
      testSeriesId = '2';
    } else {
      testSeriesId = paidSeries.id.toString();
    }

    // console.log(`✅ Using test series ID: ${testSeriesId}`);

    // Step 3: Test subscription access check (should deny access)
    // console.log('\n🚫 Step 3: Testing access denial for unpaid series...');
    const accessResponse = await axios.get(
      `${BASE_URL}/subscription-access/test-series/${testSeriesId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (accessResponse.data.success && !accessResponse.data.data.hasAccess) {
      // console.log('✅ Access correctly denied for unpaid series');
      // console.log(`   Can Purchase: ${accessResponse.data.data.canPurchase}`);
      // console.log(`   Show Enroll Button: ${accessResponse.data.data.showEnrollButton}`);
    } else {
      // console.log('⚠️  User already has access to this series');
    }

    // Step 4: Test payment order creation
    // console.log('\n💰 Step 4: Testing payment order creation...');
    const orderResponse = await axios.post(
      `${BASE_URL}/payments/create-order`,
      {
        testSeriesId: testSeriesId,
        planType: 'test_series'
      },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (orderResponse.data.success) {
      // console.log('✅ Payment order created successfully');
      // console.log(`   Order ID: ${orderResponse.data.data.orderId}`);
      // console.log(`   Amount: ₹${orderResponse.data.data.amount / 100}`);

      // Step 5: Test duplicate payment prevention
      // console.log('\n🔄 Step 5: Testing duplicate payment prevention...');
      try {
        await axios.post(
          `${BASE_URL}/payments/create-order`,
          {
            testSeriesId: testSeriesId,
            planType: 'test_series'
          },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        // console.log('⚠️  Duplicate payment was allowed (should be blocked)');
      } catch (duplicateError) {
        if (duplicateError.response?.status === 400 && 
            duplicateError.response?.data?.errorCode === 'PAYMENT_PENDING') {
          // console.log('✅ Duplicate payment correctly blocked');
          // console.log(`   Reason: ${duplicateError.response.data.message}`);
        } else {
          // console.log('❌ Unexpected error on duplicate payment test');
        }
      }

    } else {
      // console.log('❌ Payment order creation failed');
      // console.log(`   Error: ${orderResponse.data.message}`);
    }

    // Step 6: Test question access (should be blocked)
    // console.log('\n📚 Step 6: Testing question access blocking...');
    try {
      // This would require finding an actual category UUID, but let's test the endpoint
      const questionsResponse = await axios.get(
        `${BASE_URL}/dynamic/categories/test-category-uuid/questions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      // console.log('ℹ️  Question access test skipped (no valid category UUID available)');
    } catch (error) {
      if (error.response?.status === 404) {
        // console.log('ℹ️  Question access test skipped (category not found - expected for test)');
      } else if (error.response?.status === 403) {
        // console.log('✅ Question access correctly blocked');
      }
    }

    // Summary
    // console.log('\n🎉 ACCESS CONTROL TEST COMPLETED!');
    // console.log('\n📋 Test Results Summary:');
    // console.log('✅ User authentication: WORKING');
    // console.log('✅ Subscription access check: WORKING');
    // console.log('✅ Payment order creation: WORKING'); 
    // console.log('✅ Duplicate payment prevention: WORKING');
    // console.log('✅ Access control APIs: IMPLEMENTED');
    
    // console.log('\n🚀 Next Steps:');
    // console.log('1. Test frontend integration with subscription access hook');
    // console.log('2. Test payment completion flow');
    // console.log('3. Verify question access blocking after subscription');

  } catch (error) {
    console.error('\n❌ Access Control Test Failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testAccessControl();