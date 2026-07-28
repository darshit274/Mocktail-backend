/**
 * Dummy Data Seeder — uses Sequelize models directly.
 *
 * The admin panel uses a "simple hierarchy":
 *   TestSeries → Category (container, level 0)
 *              → Category (question_holder, level 1, parent_category_id set)
 *              → Question (category_id set, no Test/SubCategory)
 *
 * Sub-categories / Tests / Questions via test_id are the OLD system —
 * they don't appear in the admin panel UI.
 *
 * Usage: node seeders/dummy-data-seeder.js
 */

require('dotenv').config();
const db = require('../models');
const { TestSeries, Category, SubCategory, Test, Question, PdfCategory, sequelize } = db;

const log  = (msg) => {}; // console.log(`  ✅  ${msg}`);
const fail = (msg, err) => { console.error(`  ❌  ${msg}:`, err.message || err); };

const ANSWER_MAP = ['A', 'B', 'C', 'D'];

// ─── CLEANUP ──────────────────────────────────────────────────────────────────

async function cleanup() {
  // console.log('\n🧹  Cleaning up previously seeded data...\n');
  // Disable FK checks so we can delete in any order
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = ['user_answers', 'test_sessions', 'leaderboard_entries', 'question_reports', 'questions', 'sub_categories', 'tests', 'new_tests', 'categories', 'new_test_series', 'pdf_categories'];
  for (const t of tables) {
    await sequelize.query(`DELETE FROM \`${t}\``);
    log(`Cleared table: ${t}`);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const SERIES_DEFS = [
  {
    name: 'GPSC Class 1-2 Exam Preparation',
    name_gujarati: 'GPSC વર્ગ ૧-૨ પરીક્ષા તૈયારી',
    description: 'Comprehensive preparation for GPSC Class 1 and Class 2 civil services examination covering all major topics.',
    pricing_type: 'paid',
    price: 299.00,
    validity_days: 365,
    difficulty_level: 'intermediate',
    is_featured: true,
    is_published: true,
    is_active: true,
    display_order: 1,
    // Containers hold leaf categories; leaf categories (question_holder) hold questions.
    categories: [
      {
        name: 'General Studies',
        name_gujarati: 'સામાન્ય અભ્યાસ',
        node_type: 'container',
        display_order: 1,
        children: [
          {
            name: 'History & Culture',
            name_gujarati: 'ઇતિહાસ અને સંસ્કૃતિ',
            node_type: 'question_holder',
            display_order: 1,
            test_duration_minutes: 30,
            is_free_in_paid_series: true,
            questions: [
              { q: 'Which dynasty built the Ajanta Caves?', opts: ['Gupta', 'Vakataka', 'Maurya', 'Satavahana'], ans: 1, exp: 'The Ajanta Caves were built primarily under the patronage of the Vakataka dynasty.' },
              { q: 'The Indus Valley Civilization was discovered in which year?', opts: ['1901', '1921', '1935', '1947'], ans: 1, exp: 'The Indus Valley Civilization was discovered in 1921 by archaeologists.' },
              { q: 'Who wrote the Arthashastra?', opts: ['Chanakya', 'Ashoka', 'Chandragupta', 'Kalidasa'], ans: 0, exp: 'Arthashastra was written by Chanakya (Kautilya), advisor to Chandragupta Maurya.' },
              { q: "Ashoka's Dhamma was inspired by:", opts: ['Jainism', 'Hinduism', 'Buddhism', 'Zoroastrianism'], ans: 2, exp: 'Ashoka adopted Buddhism after the Kalinga War and based his Dhamma on Buddhist principles.' },
              { q: 'The capital of the Mauryan Empire was:', opts: ['Taxila', 'Pataliputra', 'Vaishali', 'Rajgir'], ans: 1, exp: 'Pataliputra (modern-day Patna) was the capital of the Mauryan Empire.' },
              { q: 'Who founded the Mughal Empire in India?', opts: ['Akbar', 'Babur', 'Humayun', 'Shah Jahan'], ans: 1, exp: 'Babur founded the Mughal Empire in 1526 after the First Battle of Panipat.' },
              { q: 'The Battle of Haldighati (1576) was fought between:', opts: ['Akbar and Rana Pratap', 'Aurangzeb and Shivaji', 'Babur and Ibrahim Lodi', 'Humayun and Sher Shah'], ans: 0, exp: "The Battle of Haldighati was fought between Akbar's forces and Maharana Pratap of Mewar." },
              { q: 'Taj Mahal was built by which Mughal Emperor?', opts: ['Akbar', 'Jahangir', 'Shah Jahan', 'Aurangzeb'], ans: 2, exp: 'Shah Jahan built the Taj Mahal in memory of his wife Mumtaz Mahal.' },
              { q: 'Delhi Sultanate was established in:', opts: ['1206', '1526', '1192', '1290'], ans: 0, exp: 'The Delhi Sultanate was established in 1206 by Qutb ud-Din Aibak.' },
              { q: 'Who was the founder of the Vijayanagara Empire?', opts: ['Harihara I', 'Krishnadevaraya', 'Bukka I', 'Deva Raya II'], ans: 0, exp: 'Harihara I, along with his brother Bukka Raya I, founded the Vijayanagara Empire in 1336.' },
            ],
          },
          {
            name: 'Indian Geography',
            name_gujarati: 'ભારતીય ભૂગોળ',
            node_type: 'question_holder',
            display_order: 2,
            test_duration_minutes: 20,
            is_free_in_paid_series: true,
            questions: [
              { q: 'Which is the longest river in India?', opts: ['Ganga', 'Godavari', 'Brahmaputra', 'Yamuna'], ans: 0, exp: 'The Ganga is the longest river in India, stretching about 2,525 km.' },
              { q: 'The Thar Desert is located in which state?', opts: ['Gujarat', 'Rajasthan', 'Punjab', 'Haryana'], ans: 1, exp: 'The Thar Desert, also known as the Great Indian Desert, is mainly located in Rajasthan.' },
              { q: 'Which mountain range separates India and China?', opts: ['Aravalli', 'Vindhya', 'Himalayas', 'Satpura'], ans: 2, exp: 'The Himalayas form the natural boundary between India and China.' },
              { q: 'The Deccan Plateau is bounded on the east by:', opts: ['Western Ghats', 'Eastern Ghats', 'Satpura Range', 'Vindhya Range'], ans: 1, exp: 'The Deccan Plateau is bounded by the Eastern Ghats on the east.' },
              { q: 'Chilika Lake is located in which state?', opts: ['West Bengal', 'Andhra Pradesh', 'Odisha', 'Tamil Nadu'], ans: 2, exp: 'Chilika Lake, the largest coastal lagoon in India, is located in Odisha.' },
            ],
          },
        ],
      },
      {
        name: 'Current Affairs',
        name_gujarati: 'ચાલુ ઘટનાઓ',
        node_type: 'container',
        display_order: 2,
        children: [
          {
            name: 'Monthly Current Affairs',
            name_gujarati: 'માસિક ચાલુ ઘટનાઓ',
            node_type: 'question_holder',
            display_order: 1,
            test_duration_minutes: 15,
            is_free_in_paid_series: true,
            questions: [
              { q: "India's GDP growth rate for FY 2025-26 was approximately:", opts: ['5.5%', '6.5%', '7.0%', '8.2%'], ans: 2, exp: "India's GDP growth for FY 2025-26 was approximately 7.0% according to government estimates." },
              { q: 'Which country hosted the G20 Summit in 2025?', opts: ['India', 'South Africa', 'Brazil', 'USA'], ans: 2, exp: 'Brazil hosted the G20 Summit in 2025.' },
              { q: 'Who is the current Chief Election Commissioner of India (2026)?', opts: ['Rajiv Kumar', 'Gyanesh Kumar', 'Sushil Chandra', 'Nasim Zaidi'], ans: 1, exp: 'Gyanesh Kumar is serving as the Chief Election Commissioner of India in 2026.' },
              { q: 'Operation Sindoor was conducted by India in:', opts: ['2023', '2024', '2025', '2026'], ans: 2, exp: 'Operation Sindoor was conducted by India in 2025.' },
              { q: 'Which Indian city is known as the "Silicon Valley of India"?', opts: ['Mumbai', 'Hyderabad', 'Pune', 'Bengaluru'], ans: 3, exp: 'Bengaluru (Bangalore) is known as the Silicon Valley of India due to its IT industry hub.' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'English Grammar & Vocabulary',
    name_gujarati: 'અંગ્રેજી વ્યાકરણ અને શબ્દભંડોળ',
    description: 'Master English grammar rules, vocabulary, and comprehension skills for competitive exams.',
    pricing_type: 'free',
    price: 0.00,
    validity_days: 365,
    difficulty_level: 'beginner',
    is_featured: false,
    is_published: true,
    is_active: true,
    display_order: 2,
    categories: [
      {
        name: 'Grammar Fundamentals',
        name_gujarati: 'વ્યાકરણ મૂળભૂત',
        node_type: 'container',
        display_order: 1,
        children: [
          {
            name: 'Parts of Speech',
            name_gujarati: 'વાણીના ભેદ',
            node_type: 'question_holder',
            display_order: 1,
            test_duration_minutes: 15,
            is_free_in_paid_series: true,
            questions: [
              { q: 'Which of the following is a proper noun?', opts: ['city', 'river', 'Ahmedabad', 'mountain'], ans: 2, exp: 'Ahmedabad is a proper noun as it names a specific city.' },
              { q: 'Identify the pronoun: "She gave him a book."', opts: ['gave', 'She', 'book', 'a'], ans: 1, exp: '"She" is a personal pronoun replacing the name of a female person.' },
              { q: '"Honesty is the best policy." — What kind of noun is "honesty"?', opts: ['Proper noun', 'Abstract noun', 'Collective noun', 'Material noun'], ans: 1, exp: 'Honesty is an abstract noun as it refers to a quality that cannot be seen or touched.' },
              { q: 'Which pronoun replaces a plural noun?', opts: ['He', 'She', 'It', 'They'], ans: 3, exp: '"They" is a plural pronoun used to replace plural nouns.' },
              { q: '"A pride of lions" — what kind of noun is "pride"?', opts: ['Abstract', 'Collective', 'Proper', 'Material'], ans: 1, exp: '"Pride" here is a collective noun referring to a group of lions.' },
            ],
          },
          {
            name: 'Tenses',
            name_gujarati: 'કાળ',
            node_type: 'question_holder',
            display_order: 2,
            test_duration_minutes: 20,
            is_free_in_paid_series: true,
            questions: [
              { q: '"She __ (study) for 3 hours." — Choose the correct tense:', opts: ['studied', 'has been studying', 'had studied', 'was studying'], ans: 1, exp: 'Present perfect continuous "has been studying" is used for an action that started in the past and is still continuing.' },
              { q: 'Which sentence is in Past Perfect tense?', opts: ['She sings well', 'He had finished the work', 'They are playing', 'I will come tomorrow'], ans: 1, exp: '"Had finished" is the past perfect form, indicating an action completed before another past action.' },
              { q: 'Identify the tense: "The train will have left by 9 PM."', opts: ['Simple Future', 'Future Perfect', 'Future Continuous', 'Future Perfect Continuous'], ans: 1, exp: '"Will have left" is Future Perfect tense, indicating an action that will be completed at a specific future time.' },
              { q: '"I __ him for years." — Fill in the correct form of "know":', opts: ['know', 'knew', 'have known', 'had known'], ans: 2, exp: '"Have known" (Present Perfect) is used for an action that started in the past and continues to the present.' },
              { q: 'Which sentence uses Simple Present tense correctly?', opts: ['She is going to school', 'He goes to school daily', 'They went to school', 'We will go to school'], ans: 1, exp: '"He goes to school daily" uses Simple Present tense for a habitual action.' },
            ],
          },
        ],
      },
    ],
  },
];

const PDF_CATEGORY_DEFS = [
  {
    name: 'Study Materials',
    name_gujarati: 'અભ્યાસ સામગ્રી',
    description: 'Important study notes and materials for competitive exams.',
    pricing_type: 'paid',
    price: 20,
    display_order: 1,
    node_type: 'container',
    subcategories: [
      { name: 'English',         name_gujarati: 'અંગ્રેજી',       description: 'English grammar and vocabulary study material', display_order: 1 },
      { name: 'General Studies', name_gujarati: 'સામાન્ય અભ્યાસ', description: 'General Studies notes for GPSC and other exams', display_order: 2 },
      { name: 'Gujarati',        name_gujarati: 'ગુજરાતી',         description: 'Gujarati language and literature materials', display_order: 3 },
    ],
  },
  {
    name: 'Previous Year Papers',
    name_gujarati: 'ગત વર્ષ પ્રશ્નપત્રો',
    description: 'Previous year question papers for GPSC, PSI, Constable and other Gujarat exams.',
    pricing_type: 'paid',
    price: 30,
    display_order: 2,
    node_type: 'container',
    subcategories: [
      { name: 'GPSC Papers',    name_gujarati: 'GPSC પ્રશ્નપત્રો', description: 'GPSC Class 1-2 previous year papers', display_order: 1 },
      { name: 'PSI / ASI',      name_gujarati: 'PSI / ASI',          description: 'Police Sub-Inspector exam papers', display_order: 2 },
      { name: 'Bin Sachivalay', name_gujarati: 'બિન સચિવાલય',       description: 'Bin Sachivalay clerk exam papers', display_order: 3 },
    ],
  },
  {
    name: 'Free Resources',
    name_gujarati: 'મફત સ્ત્રોત',
    description: 'Free downloadable resources for all students.',
    pricing_type: 'free',
    price: 0,
    display_order: 3,
    node_type: 'container',
    subcategories: [
      { name: 'Formulas & Charts',    name_gujarati: 'સૂત્રો અને ચાર્ટ', description: 'Quick reference formula sheets and charts', display_order: 1 },
      { name: 'Current Affairs PDFs', name_gujarati: 'ચાલુ ઘટના PDF',    description: 'Monthly current affairs PDFs', display_order: 2 },
    ],
  },
];

// ─── SEEDER FUNCTIONS ─────────────────────────────────────────────────────────

async function seedTestSeries(def) {
  const ts = await TestSeries.create({
    name: def.name,
    name_gujarati: def.name_gujarati,
    description: def.description,
    pricing_type: def.pricing_type,
    price: def.price,
    validity_days: def.validity_days,
    difficulty_level: def.difficulty_level,
    is_featured: def.is_featured,
    is_published: def.is_published,
    is_active: def.is_active,
    display_order: def.display_order,
  });
  log(`TestSeries: "${ts.name}" (id ${ts.id})`);

  for (const catDef of def.categories) {
    // Level-0 container category
    const parent = await Category.create({
      test_series_id: ts.id,
      name: catDef.name,
      name_gujarati: catDef.name_gujarati || null,
      node_type: catDef.node_type,
      display_order: catDef.display_order,
      hierarchy_level: 0,
      parent_category_id: null,
      is_active: true,
    });
    log(`  Category (container, lvl 0): "${parent.name}" (id ${parent.id})`);

    for (const childDef of (catDef.children || [])) {
      // Level-1 question_holder category — questions go directly here
      const leaf = await Category.create({
        test_series_id: ts.id,
        name: childDef.name,
        name_gujarati: childDef.name_gujarati || null,
        node_type: childDef.node_type,
        display_order: childDef.display_order,
        hierarchy_level: 1,
        parent_category_id: parent.id,
        test_duration_minutes: childDef.test_duration_minutes ?? 30,
        is_free_in_paid_series: childDef.is_free_in_paid_series ?? false,
        is_active: true,
      });
      log(`    Category (question_holder, lvl 1): "${leaf.name}" (id ${leaf.id})`);

      for (let i = 0; i < (childDef.questions || []).length; i++) {
        const q = childDef.questions[i];
        await Question.create({
          category_id: leaf.id,
          test_id: null,
          question_text: q.q,
          option_a: q.opts[0],
          option_b: q.opts[1],
          option_c: q.opts[2],
          option_d: q.opts[3],
          correct_answer: ANSWER_MAP[q.ans],
          explanation: q.exp,
          marks: 1,
          display_order: i + 1,
          is_active: true,
        });
      }
      log(`      ${(childDef.questions || []).length} questions added`);
    }
  }
}

async function seedPdfCategories(def) {
  const root = await PdfCategory.create({
    name: def.name,
    name_gujarati: def.name_gujarati || null,
    description: def.description || null,
    pricing_type: def.pricing_type,
    price: def.price,
    display_order: def.display_order,
    node_type: def.node_type,
    hierarchy_level: 0,
    parent_category_id: null,
    is_active: true,
  });
  log(`PDF Category: "${root.name}" (id ${root.id}, uuid ${root.uuid})`);

  for (let i = 0; i < def.subcategories.length; i++) {
    const sub = def.subcategories[i];
    await PdfCategory.create({
      name: sub.name,
      name_gujarati: sub.name_gujarati || null,
      description: sub.description || null,
      pricing_type: def.pricing_type,
      price: def.price,
      parent_category_id: root.id,
      hierarchy_level: 1,
      display_order: sub.display_order ?? i + 1,
      node_type: 'pdf_holder',
      is_active: true,
    });
    log(`  PDF SubCategory: "${sub.name}"`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  // console.log('\n🌱  Starting dummy data seeder (direct DB mode)...\n');

  try {
    await sequelize.authenticate();
    log('DB connection established');
  } catch (e) {
    fail('DB connection failed', e);
    process.exit(1);
  }

  await cleanup();

  // console.log('\n📚  Seeding Test Series (Courses) with simple hierarchy...\n');
  for (const def of SERIES_DEFS) {
    try {
      await seedTestSeries(def);
    } catch (e) {
      fail(`TestSeries "${def.name}"`, e);
    }
  }

  // console.log('\n📄  Seeding PDF Categories...\n');
  for (const def of PDF_CATEGORY_DEFS) {
    try {
      await seedPdfCategories(def);
    } catch (e) {
      fail(`PDF Category "${def.name}"`, e);
    }
  }

  await sequelize.close();
  // console.log('\n✨  Done! All dummy data seeded successfully.\n');
})();
