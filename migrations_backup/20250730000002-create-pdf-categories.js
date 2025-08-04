'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pdf_categories', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Category name (e.g., Study Materials, Previous Papers, etc.)'
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'URL-friendly version of name'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      icon: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Icon name for category display'
      },
      color: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: '#3B82F6',
        comment: 'Hex color code for category'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Display order for categories'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('pdf_categories', ['slug']);
    await queryInterface.addIndex('pdf_categories', ['is_active']);
    await queryInterface.addIndex('pdf_categories', ['sort_order']);

    // Add default categories
    await queryInterface.bulkInsert('pdf_categories', [
      {
        name: 'Study Materials',
        slug: 'study-materials',
        description: 'General study materials and notes',
        icon: 'BookOpen',
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
        icon: 'FileText',
        color: '#10B981',
        sort_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Reference Books',
        slug: 'reference-books',
        description: 'Reference books and e-books',
        icon: 'Book',
        color: '#8B5CF6',
        sort_order: 3,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Practice Sets',
        slug: 'practice-sets',
        description: 'Practice question sets and mock tests',
        icon: 'Target',
        color: '#F59E0B',
        sort_order: 4,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Syllabus & Patterns',
        slug: 'syllabus-patterns',
        description: 'Exam syllabus and pattern documents',
        icon: 'ClipboardList',
        color: '#EF4444',
        sort_order: 5,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pdf_categories');
  }
};