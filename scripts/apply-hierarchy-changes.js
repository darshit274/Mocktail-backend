const { sequelize } = require('../models');

async function applyHierarchyChanges() {
  // console.log('🔄 Applying simplified hierarchy changes...');

  try {
    // Check if columns already exist
    const [categoriesDesc] = await sequelize.query("DESCRIBE categories");
    const existingCols = categoriesDesc.map(col => col.Field);
    
    // console.log('📋 Current categories columns:', existingCols);

    // Add node_type column if it doesn't exist
    if (!existingCols.includes('node_type')) {
      // console.log('➕ Adding node_type column...');
      await sequelize.query(`
        ALTER TABLE categories 
        ADD COLUMN node_type ENUM('unset', 'container', 'question_holder') 
        DEFAULT 'unset' NOT NULL
        COMMENT 'Type of node: unset (can become either), container (has subcategories), question_holder (has questions)'
      `);
    }

    // Add parent_category_id column if it doesn't exist
    if (!existingCols.includes('parent_category_id')) {
      // console.log('➕ Adding parent_category_id column...');
      await sequelize.query(`
        ALTER TABLE categories 
        ADD COLUMN parent_category_id INT NULL
        COMMENT 'Parent category for hierarchical structure'
      `);
      
      // Add foreign key constraint
      await sequelize.query(`
        ALTER TABLE categories 
        ADD CONSTRAINT fk_categories_parent 
        FOREIGN KEY (parent_category_id) REFERENCES categories(id) 
        ON UPDATE CASCADE ON DELETE CASCADE
      `);
    }

    // Add hierarchy_level column if it doesn't exist
    if (!existingCols.includes('hierarchy_level')) {
      // console.log('➕ Adding hierarchy_level column...');
      await sequelize.query(`
        ALTER TABLE categories 
        ADD COLUMN hierarchy_level INT DEFAULT 0 NOT NULL
        COMMENT 'Depth level in hierarchy (0 = root, 1 = subcategory, etc.)'
      `);
    }

    // Add display_order column if it doesn't exist
    if (!existingCols.includes('display_order')) {
      // console.log('➕ Adding display_order column...');
      await sequelize.query(`
        ALTER TABLE categories 
        ADD COLUMN display_order INT DEFAULT 0 NOT NULL
        COMMENT 'Order for display within same parent'
      `);
    }

    // Add indexes
    // console.log('📊 Adding indexes...');
    try {
      await sequelize.query(`
        CREATE INDEX idx_categories_parent ON categories(parent_category_id)
      `);
      // console.log('✅ Added idx_categories_parent');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) {
        throw e;
      }
      // console.log('⚠️ Index idx_categories_parent already exists');
    }

    try {
      await sequelize.query(`
        CREATE INDEX idx_categories_test_series_level ON categories(test_series_id, hierarchy_level)
      `);
      // console.log('✅ Added idx_categories_test_series_level');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) {
        throw e;
      }
      // console.log('⚠️ Index idx_categories_test_series_level already exists');
    }

    try {
      await sequelize.query(`
        CREATE INDEX idx_categories_node_type ON categories(node_type)
      `);
      // console.log('✅ Added idx_categories_node_type');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) {
        throw e;
      }
      // console.log('⚠️ Index idx_categories_node_type already exists');
    }

    // Now handle questions table
    // console.log('🔄 Updating questions table...');
    
    const [questionsDesc] = await sequelize.query("DESCRIBE questions");
    const existingQuestionCols = questionsDesc.map(col => col.Field);
    
    // console.log('📋 Current questions columns:', existingQuestionCols);

    // Add category_id column to questions if it doesn't exist
    if (!existingQuestionCols.includes('category_id')) {
      // console.log('➕ Adding category_id column to questions...');
      await sequelize.query(`
        ALTER TABLE questions 
        ADD COLUMN category_id INT NULL
        COMMENT 'Direct link to category for simplified hierarchy'
      `);
      
      // Add foreign key constraint
      await sequelize.query(`
        ALTER TABLE questions 
        ADD CONSTRAINT fk_questions_category 
        FOREIGN KEY (category_id) REFERENCES categories(id) 
        ON UPDATE CASCADE ON DELETE SET NULL
      `);
    }

    // Add display_order column to questions if it doesn't exist
    if (!existingQuestionCols.includes('display_order')) {
      // console.log('➕ Adding display_order column to questions...');
      await sequelize.query(`
        ALTER TABLE questions 
        ADD COLUMN display_order INT DEFAULT 0 NOT NULL
        COMMENT 'Order for display within category'
      `);
    }

    // Add index for questions
    try {
      await sequelize.query(`
        CREATE INDEX idx_questions_category ON questions(category_id)
      `);
      // console.log('✅ Added idx_questions_category');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) {
        throw e;
      }
      // console.log('⚠️ Index idx_questions_category already exists');
    }

    // console.log('✅ All simplified hierarchy changes applied successfully!');

  } catch (error) {
    console.error('❌ Error applying hierarchy changes:', error);
    throw error;
  }
}

// Run the migration
applyHierarchyChanges()
  .then(() => {
    // console.log('🎉 Database changes completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to apply database changes:', error);
    process.exit(1);
  });