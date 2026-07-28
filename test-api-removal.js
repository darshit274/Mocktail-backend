/**
 * Test Script to verify demo_tests_count and subscription_duration_days removal
 * Tests all admin test series APIs to ensure they work without these fields
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@mocktail.com';
const ADMIN_PASSWORD = 'admin123';

let adminToken = '';
let testSeriesUuid = '';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  // console.log(`${colors[color]}${message}${colors.reset}`);
}

async function loginAsAdmin() {
  try {
    log('\n🔑 Step 1: Admin Login...', 'blue');
    const response = await axios.post(`${BASE_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (response.data.success && response.data.token) {
      adminToken = response.data.token;
      log('✅ Admin login successful', 'green');
      log(`   Token: ${adminToken.substring(0, 30)}...`, 'yellow');
      return true;
    } else {
      log('❌ Admin login failed: No token received', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Admin login error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function getAllTestSeries() {
  try {
    log('\n📋 Step 2: GET All Test Series...', 'blue');
    const response = await axios.get(`${BASE_URL}/admin/test-management?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (response.data.success) {
      log('✅ GET all test series successful', 'green');
      const testSeries = response.data.data || response.data.testSeries || [];

      if (testSeries.length > 0) {
        testSeriesUuid = testSeries[0].uuid;
        log(`   Found ${testSeries.length} test series`, 'yellow');
        log(`   First test series UUID: ${testSeriesUuid}`, 'yellow');

        // Check if removed fields are present
        const firstSeries = testSeries[0];
        if ('demo_tests_count' in firstSeries) {
          log('   ⚠️  WARNING: demo_tests_count still present in response!', 'yellow');
        }
        if ('subscription_duration_days' in firstSeries) {
          log('   ⚠️  WARNING: subscription_duration_days still present in response!', 'yellow');
        }
        if (!('demo_tests_count' in firstSeries) && !('subscription_duration_days' in firstSeries)) {
          log('   ✅ Removed fields not present in response', 'green');
        }
      } else {
        log('   No test series found', 'yellow');
      }
      return true;
    } else {
      log('❌ GET all test series failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ GET all test series error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function createTestSeries() {
  try {
    log('\n➕ Step 3: POST Create Test Series...', 'blue');
    const newTestSeries = {
      title: 'API Test Series',
      description: 'Test series created by API test script',
      title_gujarati: 'API ટેસ્ટ સિરીઝ',
      description_gujarati: 'API પરીક્ષણ સ્ક્રિપ્ટ દ્વારા બનાવેલ પરીક્ષણ શ્રેણી',
      is_active: true,
      pricing_type: 'paid',
      price: 499,
      currency: 'INR',
      discount_percentage: 10,
      is_featured: false,
    };

    log('   Request body:', 'yellow');
    log(`   ${JSON.stringify(newTestSeries, null, 2)}`, 'yellow');

    const response = await axios.post(`${BASE_URL}/admin/test-management`, newTestSeries, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (response.data.success) {
      log('✅ POST create test series successful', 'green');
      testSeriesUuid = response.data.data?.uuid || response.data.testSeries?.uuid;
      log(`   Created test series UUID: ${testSeriesUuid}`, 'yellow');

      // Check if removed fields were in request/response
      log('   ✅ Successfully created without demo_tests_count and subscription_duration_days', 'green');
      return true;
    } else {
      log('❌ POST create test series failed', 'red');
      log(`   Response: ${JSON.stringify(response.data)}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ POST create test series error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response status: ${error.response.status}`, 'red');
      log(`   Response data: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function getTestSeriesById() {
  if (!testSeriesUuid) {
    log('\n⏭️  Step 4: Skipping GET by ID (no UUID available)', 'yellow');
    return false;
  }

  try {
    log(`\n🔍 Step 4: GET Test Series by UUID (${testSeriesUuid})...`, 'blue');
    const response = await axios.get(`${BASE_URL}/admin/test-management/${testSeriesUuid}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (response.data.success) {
      log('✅ GET test series by ID successful', 'green');
      const testSeries = response.data.data || response.data.testSeries;

      // Check if removed fields are present
      if ('demo_tests_count' in testSeries) {
        log('   ⚠️  WARNING: demo_tests_count still present in response!', 'yellow');
      }
      if ('subscription_duration_days' in testSeries) {
        log('   ⚠️  WARNING: subscription_duration_days still present in response!', 'yellow');
      }
      if (!('demo_tests_count' in testSeries) && !('subscription_duration_days' in testSeries)) {
        log('   ✅ Removed fields not present in response', 'green');
      }
      return true;
    } else {
      log('❌ GET test series by ID failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ GET test series by ID error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function updateTestSeries() {
  if (!testSeriesUuid) {
    log('\n⏭️  Step 5: Skipping PUT update (no UUID available)', 'yellow');
    return false;
  }

  try {
    log(`\n✏️  Step 5: PUT Update Test Series (${testSeriesUuid})...`, 'blue');
    const updateData = {
      title: 'API Test Series - Updated',
      description: 'Updated by API test script',
      is_active: true,
      pricing_type: 'paid',
      price: 599,
      discount_percentage: 15,
    };

    log('   Request body:', 'yellow');
    log(`   ${JSON.stringify(updateData, null, 2)}`, 'yellow');

    const response = await axios.put(`${BASE_URL}/admin/test-management/${testSeriesUuid}`, updateData, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (response.data.success) {
      log('✅ PUT update test series successful', 'green');
      log('   ✅ Successfully updated without demo_tests_count and subscription_duration_days', 'green');
      return true;
    } else {
      log('❌ PUT update test series failed', 'red');
      log(`   Response: ${JSON.stringify(response.data)}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ PUT update test series error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response status: ${error.response.status}`, 'red');
      log(`   Response data: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

async function runTests() {
  log('\n═══════════════════════════════════════════════════════', 'blue');
  log('🧪 API TESTING: demo_tests_count & subscription_duration_days Removal', 'blue');
  log('═══════════════════════════════════════════════════════\n', 'blue');

  const results = {
    login: false,
    getAll: false,
    create: false,
    getById: false,
    update: false,
  };

  // Run tests sequentially
  results.login = await loginAsAdmin();
  if (!results.login) {
    log('\n❌ Cannot proceed without admin authentication', 'red');
    return;
  }

  results.getAll = await getAllTestSeries();
  results.create = await createTestSeries();
  results.getById = await getTestSeriesById();
  results.update = await updateTestSeries();

  // Print summary
  log('\n═══════════════════════════════════════════════════════', 'blue');
  log('📊 TEST SUMMARY', 'blue');
  log('═══════════════════════════════════════════════════════', 'blue');
  log(`Admin Login:           ${results.login ? '✅ PASS' : '❌ FAIL'}`, results.login ? 'green' : 'red');
  log(`GET All Test Series:   ${results.getAll ? '✅ PASS' : '❌ FAIL'}`, results.getAll ? 'green' : 'red');
  log(`POST Create Series:    ${results.create ? '✅ PASS' : '❌ FAIL'}`, results.create ? 'green' : 'red');
  log(`GET Series by UUID:    ${results.getById ? '✅ PASS' : '❌ FAIL'}`, results.getById ? 'green' : 'red');
  log(`PUT Update Series:     ${results.update ? '✅ PASS' : '❌ FAIL'}`, results.update ? 'green' : 'red');
  log('═══════════════════════════════════════════════════════\n', 'blue');

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(0);

  log(`Total: ${passedTests}/${totalTests} tests passed (${successRate}%)`, passedTests === totalTests ? 'green' : 'yellow');

  if (passedTests === totalTests) {
    log('\n🎉 ALL TESTS PASSED! APIs working correctly without removed fields.', 'green');
  } else {
    log('\n⚠️  SOME TESTS FAILED. Please review the errors above.', 'yellow');
  }
}

// Run the tests
runTests().catch(error => {
  log(`\n💥 Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
