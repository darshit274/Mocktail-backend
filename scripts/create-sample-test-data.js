const { TestSeries, Category, SubCategory, Test, Question } = require('../models');

async function createSampleData() {
  try {
    // console.log('Creating sample test data...');

    // Create Test Series
    const testSeries = await TestSeries.create({
      name: 'GPSC Mock Test Series',
      description: 'Comprehensive mock test series for GPSC examination preparation'
    });

    // console.log('✅ Created test series:', testSeries.name);

    // Create Categories
    const mathCategory = await Category.create({
      test_series_id: testSeries.id,
      name: 'Mathematics',
      description: 'Mathematical concepts and problem solving'
    });

    const scienceCategory = await Category.create({
      test_series_id: testSeries.id,
      name: 'General Science',
      description: 'Physics, Chemistry, and Biology topics'
    });

    // console.log('✅ Created categories:', mathCategory.name, 'and', scienceCategory.name);

    // Create Sub-categories for Mathematics
    const algebraSubCategory = await SubCategory.create({
      category_id: mathCategory.id,
      name: 'Algebra',
      description: 'Linear equations, quadratic equations, and algebraic expressions'
    });

    const geometrySubCategory = await SubCategory.create({
      category_id: mathCategory.id,
      name: 'Geometry',
      description: 'Circles, triangles, and coordinate geometry'
    });

    // Create Sub-categories for Science
    const physicsSubCategory = await SubCategory.create({
      category_id: scienceCategory.id,
      name: 'Physics',
      description: 'Mechanics, thermodynamics, and optics'
    });

    // console.log('✅ Created sub-categories:', algebraSubCategory.name, geometrySubCategory.name, 'and', physicsSubCategory.name);

    // Create Tests
    const algebraTest = await Test.create({
      sub_category_id: algebraSubCategory.id,
      title: 'Basic Algebra Test',
      description: 'Test covering basic algebraic concepts',
      duration_minutes: 60,
      total_marks: 20
    });

    const geometryTest = await Test.create({
      sub_category_id: geometrySubCategory.id,
      title: 'Coordinate Geometry Test',
      description: 'Test on coordinate geometry and analytical geometry',
      duration_minutes: 90,
      total_marks: 30
    });

    // console.log('✅ Created tests:', algebraTest.title, 'and', geometryTest.title);

    // Create Questions for Algebra Test
    const question1 = await Question.create({
      test_id: algebraTest.id,
      question_text: 'Solve for x: 2x + 5 = 15',
      option_a: 'x = 5',
      option_b: 'x = 10',
      option_c: 'x = 7.5',
      option_d: 'x = 20',
      correct_answer: 'A',
      explanation: '2x + 5 = 15, so 2x = 10, therefore x = 5',
      marks: 2
    });

    const question2 = await Question.create({
      test_id: algebraTest.id,
      question_text: 'What is the value of x² - 4x + 4 when x = 2?',
      option_a: '0',
      option_b: '4',
      option_c: '8',
      option_d: '12',
      correct_answer: 'A',
      explanation: 'When x = 2: (2)² - 4(2) + 4 = 4 - 8 + 4 = 0',
      marks: 2
    });

    // Create Questions for Geometry Test
    const question3 = await Question.create({
      test_id: geometryTest.id,
      question_text: 'What is the distance between points (0,0) and (3,4)?',
      option_a: '7',
      option_b: '5',
      option_c: '12',
      option_d: '25',
      correct_answer: 'B',
      explanation: 'Using distance formula: √[(3-0)² + (4-0)²] = √[9 + 16] = √25 = 5',
      marks: 3
    });

    // console.log('✅ Created sample questions');

    // Update test total marks
    await algebraTest.update({ total_marks: 4 });
    await geometryTest.update({ total_marks: 3 });

    // console.log('🎉 Sample data created successfully!');
    // console.log(`
    // Created structure:
    // 📚 Test Series: "${testSeries.name}"
    // ├── 📂 Category: "${mathCategory.name}"
    // │   ├── 📁 Sub-category: "${algebraSubCategory.name}"
    // │   │   └── 📝 Test: "${algebraTest.title}" (2 questions)
    // │   └── 📁 Sub-category: "${geometrySubCategory.name}"
    // │       └── 📝 Test: "${geometryTest.title}" (1 question)
    // └── 📂 Category: "${scienceCategory.name}"
    //     └── 📁 Sub-category: "${physicsSubCategory.name}"
    // `);

  } catch (error) {
    console.error('Error creating sample data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  createSampleData().then(() => process.exit(0));
}

module.exports = createSampleData;