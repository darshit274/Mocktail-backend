const { sequelize } = require('../models');

async function createSampleTestSeries() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Create sample test series using raw SQL
    const insertQuery = `
      INSERT INTO new_test_series 
      (uuid, name, name_gujarati, description, description_gujarati, is_active, pricing_type, price, currency, demo_tests_count, subscription_duration_days, discount_percentage, is_featured, created_at, updated_at)
      VALUES 
      (UUID(), 'Sample PSI Test Series', 'નમૂના PSI ટેસ્ટ સિરીઝ', 'Complete preparation series for Police Sub Inspector exam', 'પોલીસ સબ ઇન્સ્પેક્ટર પરીક્ષા માટે સંપૂર્ણ તૈયારી શ્રેણી', 1, 'free', 0.00, 'INR', 0, 0, 0.00, 1, NOW(), NOW()),
      (UUID(), 'Premium GPSC Test Series', 'પ્રીમિયમ GPSC ટેસ્ટ સિરીઝ', 'Advanced preparation for Gujarat Public Service Commission', 'ગુજરાત લોક સેવા આયોગ માટે અદ્યતન તૈયારી', 1, 'paid', 499.00, 'INR', 3, 180, 15.00, 0, NOW(), NOW())
      ON DUPLICATE KEY UPDATE updated_at = NOW()
    `;
    
    await sequelize.query(insertQuery);
    console.log('✅ Sample test series created');
    
    // Verify data
    const [results] = await sequelize.query('SELECT * FROM new_test_series ORDER BY created_at DESC LIMIT 2');
    console.log('📊 Created test series:', results);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  createSampleTestSeries();
}

module.exports = { createSampleTestSeries };