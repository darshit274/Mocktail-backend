const { sequelize } = require('./models');

async function addColumn() {
  try {
    // console.log('Adding is_free_in_paid_series column to categories table...');

    await sequelize.query(`
      ALTER TABLE categories
      ADD COLUMN is_free_in_paid_series TINYINT(1) NOT NULL DEFAULT 0
      COMMENT 'If true, this category quiz is free even if the parent test series is paid'
    `);

    // console.log('✅ Column added successfully to categories table!');
    // console.log('\nNow restart your server and the checkbox will persist!');
    process.exit(0);
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      // console.log('✅ Column already exists!');
      process.exit(0);
    }
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addColumn();
