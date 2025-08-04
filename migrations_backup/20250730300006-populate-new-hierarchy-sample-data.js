'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Insert sample test series
    const testSeries = await queryInterface.bulkInsert('new_test_series', [
      {
        id: 1,
        uuid: 'ts-uuid-001',
        name: 'Competitive Exams Master Series',
        name_gujarati: 'સ્પર્ધાત્મક પરીક્ષા માસ્ટર સીરિઝ',
        description: 'Comprehensive test series covering all major competitive exams in Gujarat',
        description_gujarati: 'ગુજરાતની તમામ મુખ્ય સ્પર્ધાત્મક પરીક્ષાઓને આવરી લેતી વ્યાપક ટેસ્ટ સીરિઝ',
        display_order: 1,
        price: 999.00,
        original_price: 1499.00,
        is_free: false,
        free_test_count: 3,
        difficulty_level: 'mixed',
        supports_pause_resume: true,
        supports_multilanguage: true,
        has_negative_marking: true,
        negative_marks: 0.25,
        instructions: 'This comprehensive series covers all aspects of competitive exam preparation.',
        instructions_gujarati: 'આ વ્યાપક શ્રેણી સ્પર્ધાત્મક પરીક્ષાની તૈયારીના તમામ પાસાઓને આવરે છે.',
        slug: 'competitive-exams-master-series',
        is_active: true,
        is_featured: true,
        is_published: true,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        uuid: 'ts-uuid-002',
        name: 'Academic Excellence Program',
        name_gujarati: 'શૈક્ષણિક ઉત્કર્ષ કાર્યક્રમ',
        description: 'Test series for academic subjects and board exam preparation',
        description_gujarati: 'શૈક્ષણિક વિષયો અને બોર્ડ પરીક્ષાની તૈયારી માટે ટેસ્ટ સીરિઝ',
        display_order: 2,
        price: 599.00,
        original_price: 899.00,
        is_free: false,
        free_test_count: 2,
        difficulty_level: 'beginner',
        supports_pause_resume: true,
        supports_multilanguage: true,
        instructions: 'Designed for students preparing for academic excellence.',
        instructions_gujarati: 'શૈક્ષણિક ઉત્કર્ષતાની તૈયારી કરતા વિદ્યાર્થીઓ માટે ડિઝાઇન કરવામાં આવેલ.',
        slug: 'academic-excellence-program',
        is_active: true,
        is_featured: false,
        is_published: true,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        uuid: 'ts-uuid-003',
        name: 'Professional Certification Hub',
        name_gujarati: 'વ્યાવસાયિક પ્રમાણપત્ર હબ',
        description: 'Professional certification and skill-based test series',
        description_gujarati: 'વ્યાવસાયિક પ્રમાણપત્ર અને કૌશલ્ય-આધારિત ટેસ્ટ સીરિઝ',
        display_order: 3,
        price: 1299.00,
        is_free: false,
        free_test_count: 1,
        difficulty_level: 'advanced',
        supports_pause_resume: true,
        supports_multilanguage: false,
        instructions: 'Advanced test series for professional certifications.',
        slug: 'professional-certification-hub',
        is_active: true,
        is_featured: false,
        is_published: true,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { returning: true });

    // Insert Level 1 Categories (under test series)
    const level1Categories = await queryInterface.bulkInsert('hierarchy_categories', [
      // Test Series 1 - Competitive Exams
      {
        id: 1,
        uuid: 'cat-l1-001',
        name: 'Government Job Exams',
        name_gujarati: 'સરકારી નોકરીની પરીક્ષાઓ',
        description: 'All government job related competitive exams',
        test_series_id: 1,
        parent_id: null,
        hierarchy_level: 1,
        hierarchy_path: '1',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        uuid: 'cat-l1-002',
        name: 'Banking & Finance',
        name_gujarati: 'બેંકિંગ અને ફાઇનાન્સ',
        description: 'Banking and financial sector examinations',
        test_series_id: 1,
        parent_id: null,
        hierarchy_level: 1,
        hierarchy_path: '2',
        display_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Test Series 2 - Academic Excellence
      {
        id: 3,
        uuid: 'cat-l1-003',
        name: 'Science Stream',
        name_gujarati: 'વિજ્ઞાન પ્રવાહ',
        description: 'Science subjects and related topics',
        test_series_id: 2,
        parent_id: null,
        hierarchy_level: 1,
        hierarchy_path: '3',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 4,
        uuid: 'cat-l1-004',
        name: 'Commerce Stream',
        name_gujarati: 'વાણિજ્ય પ્રવાહ',
        description: 'Commerce subjects and business studies',
        test_series_id: 2,
        parent_id: null,
        hierarchy_level: 1,
        hierarchy_path: '4',
        display_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { returning: true });

    // Insert Level 2 Categories
    const level2Categories = await queryInterface.bulkInsert('hierarchy_categories', [
      // Under Government Job Exams
      {
        id: 5,
        uuid: 'cat-l2-001',
        name: 'State Level Exams',
        name_gujarati: 'રાજ્ય સ્તરની પરીક્ષાઓ',
        description: 'Gujarat state government examinations',
        test_series_id: 1,
        parent_id: 1,
        hierarchy_level: 2,
        hierarchy_path: '1/5',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 6,
        uuid: 'cat-l2-002',
        name: 'Central Level Exams',
        name_gujarati: 'કેન્દ્રીય સ્તરની પરીક્ષાઓ',
        description: 'Central government examinations',
        test_series_id: 1,
        parent_id: 1,
        hierarchy_level: 2,
        hierarchy_path: '1/6',
        display_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Under Banking & Finance
      {
        id: 7,
        uuid: 'cat-l2-003',
        name: 'Public Sector Banks',
        name_gujarati: 'જાહેર ક્ષેત્રની બેંકો',
        description: 'Public sector banking examinations',
        test_series_id: 1,
        parent_id: 2,
        hierarchy_level: 2,
        hierarchy_path: '2/7',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Under Science Stream
      {
        id: 8,
        uuid: 'cat-l2-004',
        name: 'Physics',
        name_gujarati: 'ભૌતિકશાસ્ત્ર',
        description: 'Physics related topics and concepts',
        test_series_id: 2,
        parent_id: 3,
        hierarchy_level: 2,
        hierarchy_path: '3/8',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 9,
        uuid: 'cat-l2-005',
        name: 'Chemistry',
        name_gujarati: 'રસાયણશાસ્ત્ર',
        description: 'Chemistry related topics and concepts',
        test_series_id: 2,
        parent_id: 3,
        hierarchy_level: 2,
        hierarchy_path: '3/9',
        display_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { returning: true });

    // Insert Level 3 Categories
    const level3Categories = await queryInterface.bulkInsert('hierarchy_categories', [
      // Under State Level Exams
      {
        id: 10,
        uuid: 'cat-l3-001',
        name: 'GPSC Exams',
        name_gujarati: 'જીપીએસસી પરીક્ષાઓ',
        description: 'Gujarat Public Service Commission examinations',
        test_series_id: 1,
        parent_id: 5,
        hierarchy_level: 3,
        hierarchy_path: '1/5/10',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 11,
        uuid: 'cat-l3-002',
        name: 'Gujarat Police',
        name_gujarati: 'ગુજરાત પોલીસ',
        description: 'Gujarat Police recruitment examinations',
        test_series_id: 1,
        parent_id: 5,
        hierarchy_level: 3,
        hierarchy_path: '1/5/11',
        display_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Under Public Sector Banks
      {
        id: 12,
        uuid: 'cat-l3-003',
        name: 'SBI Exams',
        name_gujarati: 'એસબીઆઈ પરીક્ષાઓ',
        description: 'State Bank of India examinations',
        test_series_id: 1,
        parent_id: 7,
        hierarchy_level: 3,
        hierarchy_path: '2/7/12',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Under Physics
      {
        id: 13,
        uuid: 'cat-l3-004',
        name: 'Mechanics',
        name_gujarati: 'યાંત્રિકશાસ્ત્ર',
        description: 'Classical mechanics and motion',
        test_series_id: 2,
        parent_id: 8,
        hierarchy_level: 3,
        hierarchy_path: '3/8/13',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 14,
        uuid: 'cat-l3-005',
        name: 'Thermodynamics',
        name_gujarati: 'ઉષ્માગતિશાસ્ત્ર',
        description: 'Heat and thermodynamic processes',
        test_series_id: 2,
        parent_id: 8,
        hierarchy_level: 3,
        hierarchy_path: '3/8/14',
        display_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { returning: true });

    // Insert Level 4 Categories (Final level before tests)
    const level4Categories = await queryInterface.bulkInsert('hierarchy_categories', [
      // Under GPSC Exams
      {
        id: 15,
        uuid: 'cat-l4-001',
        name: 'Class 1-2 Officer Posts',
        name_gujarati: 'વર્ગ ૧-૨ અધિકારી પદો',
        description: 'GPSC Class 1-2 officer level examinations',
        test_series_id: 1,
        parent_id: 10,
        hierarchy_level: 4,
        hierarchy_path: '1/5/10/15',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 16,
        uuid: 'cat-l4-002',
        name: 'Class 3 Clerk Posts',
        name_gujarati: 'વર્ગ ૩ ક્લાર્ક પદો',
        description: 'GPSC Class 3 clerk level examinations',
        test_series_id: 1,
        parent_id: 10,
        hierarchy_level: 4,
        hierarchy_path: '1/5/10/16',
        display_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Under Gujarat Police
      {
        id: 17,
        uuid: 'cat-l4-003',
        name: 'Police Sub Inspector',
        name_gujarati: 'પોલીસ સબ ઇન્સ્પેક્ટર',
        description: 'Police Sub Inspector recruitment exam',
        test_series_id: 1,
        parent_id: 11,
        hierarchy_level: 4,
        hierarchy_path: '1/5/11/17',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Under SBI Exams
      {
        id: 18,
        uuid: 'cat-l4-004',
        name: 'SBI PO',
        name_gujarati: 'એસબીઆઈ પીઓ',
        description: 'SBI Probationary Officer examination',
        test_series_id: 1,
        parent_id: 12,
        hierarchy_level: 4,
        hierarchy_path: '2/7/12/18',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      // Under Mechanics
      {
        id: 19,
        uuid: 'cat-l4-005',
        name: 'Linear Motion',
        name_gujarati: 'રેખીય ગતિ',
        description: 'Linear motion and kinematics',
        test_series_id: 2,
        parent_id: 13,
        hierarchy_level: 4,
        hierarchy_path: '3/8/13/19',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 20,
        uuid: 'cat-l4-006',
        name: 'Circular Motion',
        name_gujarati: 'વર્તુળાકાર ગતિ',
        description: 'Circular motion and rotational dynamics',
        test_series_id: 2,
        parent_id: 13,
        hierarchy_level: 4,
        hierarchy_path: '3/8/13/20',
        display_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { returning: true });

    // Insert some sample tests under level 4 categories
    const sampleTests = await queryInterface.bulkInsert('new_tests', [
      {
        id: 1,
        uuid: 'test-uuid-001',
        title: 'GPSC Class 1-2 Practice Test 1',
        title_gujarati: 'જીપીએસસી વર્ગ ૧-૨ પ્રેક્ટિસ ટેસ્ટ ૧',
        description: 'Comprehensive practice test for GPSC Class 1-2 preparation',
        test_series_id: 1,
        category_id: 15, // Class 1-2 Officer Posts
        test_type: 'practice',
        duration_minutes: 120,
        total_questions: 100,
        total_marks: 100,
        passing_marks: 50,
        is_free: true,
        has_negative_marking: true,
        negative_marks: 0.25,
        marks_per_question: 1,
        show_results_immediately: true,
        show_correct_answers: true,
        show_explanations: true,
        supports_multilanguage: true,
        is_active: true,
        is_published: true,
        published_at: new Date(),
        display_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        uuid: 'test-uuid-002',
        title: 'PSI Mock Test Series 1',
        title_gujarati: 'પીએསઆઈ મોક ટેસ્ટ સીરિઝ ૧',
        description: 'Mock test for Police Sub Inspector preparation',
        test_series_id: 1,
        category_id: 17, // Police Sub Inspector
        test_type: 'mock',
        duration_minutes: 90,
        total_questions: 75,
        total_marks: 75,
        passing_marks: 38,
        is_free: false,
        has_negative_marking: true,
        negative_marks: 0.25,
        marks_per_question: 1,
        show_results_immediately: true,
        show_correct_answers: true,
        show_explanations: true,
        supports_multilanguage: true,
        is_active: true,
        is_published: true,
        published_at: new Date(),
        display_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        uuid: 'test-uuid-003',
        title: 'Linear Motion Basics Test',
        title_gujarati: 'રેખીય ગતિ મૂળભૂત ટેસ્ટ',
        description: 'Basic concepts of linear motion and kinematics',
        test_series_id: 2,
        category_id: 19, // Linear Motion
        test_type: 'practice',
        duration_minutes: 45,
        total_questions: 30,
        total_marks: 30,
        passing_marks: 18,
        is_free: true,
        has_negative_marking: false,
        marks_per_question: 1,
        show_results_immediately: true,
        show_correct_answers: true,
        show_explanations: true,
        supports_multilanguage: true,
        is_active: true,
        is_published: true,
        published_at: new Date(),
        display_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { returning: true });

    // Insert some sample questions
    await queryInterface.bulkInsert('new_questions', [
      {
        id: 1,
        uuid: 'ques-uuid-001',
        test_id: 1,
        test_series_id: 1,
        category_id: 15,
        question_text: 'What is the capital of Gujarat?',
        question_text_gujarati: 'ગુજરાતની રાજધાની શું છે?',
        question_type: 'single_choice',
        difficulty_level: 'easy',
        marks: 1,
        options: JSON.stringify([
          { id: 'A', text: 'Ahmedabad', text_gujarati: 'અમદાવાદ' },
          { id: 'B', text: 'Gandhinagar', text_gujarati: 'ગાંધીનગર' },
          { id: 'C', text: 'Surat', text_gujarati: 'સુરત' },
          { id: 'D', text: 'Vadodara', text_gujarati: 'વડોદરા' }
        ]),
        correct_answer: JSON.stringify(['B']),
        explanation: 'Gandhinagar is the capital city of Gujarat state.',
        explanation_gujarati: 'ગાંધીનગર એ ગુજરાત રાજ્યની રાજધાની છે.',
        subject: 'General Knowledge',
        topic: 'Indian Geography',
        subtopic: 'State Capitals',
        tags: JSON.stringify(['gujarat', 'capital', 'geography']),
        estimated_time_seconds: 30,
        is_active: true,
        display_order: 1,
        source: 'GPSC Previous Papers',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        uuid: 'ques-uuid-002',
        test_id: 3,
        test_series_id: 2,
        category_id: 19,
        question_text: 'A body moves with uniform velocity. What is its acceleration?',
        question_text_gujarati: 'એક પદાર્થ એકસમાન વેગથી ગતિ કરે છે. તેનો પ્રવેગ કેટલો છે?',
        question_type: 'single_choice',
        difficulty_level: 'medium',
        marks: 1,
        options: JSON.stringify([
          { id: 'A', text: 'Zero', text_gujarati: 'શૂન્ય' },
          { id: 'B', text: 'Positive', text_gujarati: 'ધન' },
          { id: 'C', text: 'Negative', text_gujarati: 'ઋણ' },
          { id: 'D', text: 'Cannot be determined', text_gujarati: 'નક્કી કરી શકાતું નથી' }
        ]),
        correct_answer: JSON.stringify(['A']),
        explanation: 'When a body moves with uniform velocity, the rate of change of velocity is zero, hence acceleration is zero.',
        explanation_gujarati: 'જ્યારે કોઈ પદાર્થ એકસમાન વેગથી ગતિ કરે છે, ત્યારે વેગનો પરિવર્તન દર શૂન્ય હોય છે, તેથી પ્રવેગ શૂન્ય હોય છે.',
        subject: 'Physics',
        topic: 'Mechanics',
        subtopic: 'Linear Motion',
        tags: JSON.stringify(['physics', 'mechanics', 'velocity', 'acceleration']),
        estimated_time_seconds: 60,
        is_active: true,
        display_order: 1,
        source: 'NCERT Physics Class 11',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ New hierarchy system sample data populated successfully!');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('new_questions', null, {});
    await queryInterface.bulkDelete('new_tests', null, {});
    await queryInterface.bulkDelete('hierarchy_categories', null, {});
    await queryInterface.bulkDelete('new_test_series', null, {});
  }
};