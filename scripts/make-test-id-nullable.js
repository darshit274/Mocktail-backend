const mysql = require('mysql2/promise');
require('dotenv').config();

async function makeTestIdNullable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'mocktailuser',
      password: process.env.DB_PASS || '123123',
      database: process.env.DB_NAME || 'mocktail_db'
    });

    // console.log('🔗 Connected to database');

    // Check current structure
    const [rows] = await connection.execute(`DESCRIBE questions`);
    // console.log('Current questions table structure:');
    rows.forEach(row => {
      if (row.Field === 'test_id') {
        // console.log(`  test_id: ${row.Type}, Null: ${row.Null}, Default: ${row.Default}`);
      }
    });

    // Make test_id nullable
    // console.log('\n🔧 Making test_id nullable...');
    await connection.execute(`
      ALTER TABLE questions 
      MODIFY COLUMN test_id INT NULL,
      DROP FOREIGN KEY IF EXISTS questions_ibfk_1,
      ADD CONSTRAINT questions_test_id_fk 
      FOREIGN KEY (test_id) REFERENCES tests(id) 
      ON UPDATE CASCADE ON DELETE SET NULL
    `);

    // console.log('✅ test_id is now nullable with proper foreign key constraint');

    // Verify the change
    const [newRows] = await connection.execute(`DESCRIBE questions`);
    const testIdField = newRows.find(row => row.Field === 'test_id');
    // console.log(`New test_id structure: ${testIdField.Type}, Null: ${testIdField.Null}, Default: ${testIdField.Default}`);

  } catch (error) {
    console.error('❌ Error making test_id nullable:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      // console.log('🔐 Database connection closed');
    }
  }
}

makeTestIdNullable();