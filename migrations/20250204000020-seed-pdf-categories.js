'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('pdf_categories', [
      {
        name: 'Study Materials',
        slug: 'study-materials',
        description: 'General study materials and notes',
        icon: 'book',
        color: '#3B82F6',
        sort_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Previous Year Papers',
        slug: 'previous-year-papers',
        description: 'Previous year question papers and solutions',
        icon: 'file-text',
        color: '#10B981',
        sort_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Mock Tests',
        slug: 'mock-tests',
        description: 'Practice tests and mock examinations',
        icon: 'clipboard',
        color: '#F59E0B',
        sort_order: 3,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Reference Books',
        slug: 'reference-books',
        description: 'Reference books and academic literature',
        icon: 'library',
        color: '#8B5CF6',
        sort_order: 4,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Quick Revision',
        slug: 'quick-revision',
        description: 'Quick revision notes and summaries',
        icon: 'zap',
        color: '#EF4444',
        sort_order: 5,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Syllabus & Guidelines',
        slug: 'syllabus-guidelines',
        description: 'Official syllabus and exam guidelines',
        icon: 'list',
        color: '#6B7280',
        sort_order: 6,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('pdf_categories', null, {});
  }
};