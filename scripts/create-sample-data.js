const { sequelize } = require('../models');
const { User, TestSeries, Pdfs } = require('../models');
const bcrypt = require('bcryptjs');

async function createSampleData() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Create sample user
    console.log('📝 Creating sample user...');
    const hashedPassword = await bcrypt.hash('test123456', 12);
    
    const [user, userCreated] = await User.findOrCreate({
      where: { email: 'test@mocktail.com' },
      defaults: {
        username: 'testuser',
        email: 'test@mocktail.com',
        password: hashedPassword,
        phone: '1234567890',
        isEmailVerified: true,
        otp: null,
        otpExpiry: null
      }
    });

    if (userCreated) {
      console.log('✅ Sample user created: test@mocktail.com / test123456');
    } else {
      console.log('ℹ️  Sample user already exists: test@mocktail.com');
    }

    // Create sample test series
    console.log('📚 Creating sample test series...');
    const [testSeries, tsCreated] = await TestSeries.findOrCreate({
      where: { name: 'Sample PSI Test Series' },
      defaults: {
        name: 'Sample PSI Test Series',
        name_gujarati: 'નમૂના PSI ટેસ્ટ સિરીઝ',
        description: 'Complete preparation series for Police Sub Inspector exam',
        description_gujarati: 'પોલીસ સબ ઇન્સ્પેક્ટર પરીક્ષા માટે સંપૂર્ણ તૈયારી શ્રેણી',
        is_active: true,
        pricing_type: 'free',
        price: 0.00,
        currency: 'INR',
        demo_tests_count: 0,
        subscription_duration_days: 0,
        discount_percentage: 0.00,
        is_featured: true
      }
    });

    if (tsCreated) {
      console.log('✅ Sample test series created');
    } else {
      console.log('ℹ️  Sample test series already exists');
    }

    // Create another paid test series
    const [paidSeries, psCreated] = await TestSeries.findOrCreate({
      where: { name: 'Premium GPSC Test Series' },
      defaults: {
        name: 'Premium GPSC Test Series',
        name_gujarati: 'પ્રીમિયમ GPSC ટેસ્ટ સિરીઝ',
        description: 'Advanced preparation for Gujarat Public Service Commission',
        description_gujarati: 'ગુજરાત લોક સેવા આયોગ માટે અદ્યતન તૈયારી',
        is_active: true,
        pricing_type: 'paid',
        price: 499.00,
        currency: 'INR',
        demo_tests_count: 3,
        subscription_duration_days: 180,
        discount_percentage: 15.00,
        is_featured: false
      }
    });

    if (psCreated) {
      console.log('✅ Sample paid test series created');
    } else {
      console.log('ℹ️  Sample paid test series already exists');
    }

    // Create sample PDF
    console.log('📄 Creating sample PDF...');
    const [pdf, pdfCreated] = await Pdfs.findOrCreate({
      where: { title: 'Sample Study Material' },
      defaults: {
        title: 'Sample Study Material',
        description: 'Comprehensive study material for competitive exams',
        file_url: '/uploads/sample-study-material.pdf',
        file_size: 1024000, // 1MB
        category: 'Study Material',
        exam_type: 'PSI',
        test_series: 'General',
        view_count: 0,
        download_count: 0,
        created_by: user.id
      }
    });

    if (pdfCreated) {
      console.log('✅ Sample PDF created');
    } else {
      console.log('ℹ️  Sample PDF already exists');
    }

    console.log('\n🎉 Sample data creation completed!');
    console.log('\n📋 Test Credentials:');
    console.log('Email: test@mocktail.com');
    console.log('Password: test123456');
    console.log('\n📊 Sample Data:');
    console.log('- 1 Free test series');
    console.log('- 1 Paid test series'); 
    console.log('- 1 Sample PDF');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  createSampleData();
}

module.exports = { createSampleData };