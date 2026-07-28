/**
 * Script: add-session-id-columns.js
 * Purpose: Adds current_session_id column to users and admins tables
 *          for single-device login enforcement.
 * Run: node scripts/add-session-id-columns.js
 */

const { sequelize } = require('../models');
const { DataTypes } = require('sequelize');

async function run() {
  const queryInterface = sequelize.getQueryInterface();

  // --- users table ---
  const usersColumns = await queryInterface.describeTable('users');
  if (!usersColumns.current_session_id) {
    await queryInterface.addColumn('users', 'current_session_id', {
      type: DataTypes.STRING(36),
      allowNull: true,
      defaultValue: null
    });
    // console.log('✅ Added current_session_id to users table');
  } else {
    // console.log('ℹ️  current_session_id already exists in users table — skipping');
  }

  // --- admins table ---
  const adminsColumns = await queryInterface.describeTable('admins');
  if (!adminsColumns.current_session_id) {
    await queryInterface.addColumn('admins', 'current_session_id', {
      type: DataTypes.STRING(36),
      allowNull: true,
      defaultValue: null
    });
    // console.log('✅ Added current_session_id to admins table');
  } else {
    // console.log('ℹ️  current_session_id already exists in admins table — skipping');
  }

  // --- device_id on users (app device lock) ---
  if (!usersColumns.device_id) {
    await queryInterface.addColumn('users', 'device_id', {
      type: DataTypes.STRING(36),
      allowNull: true,
      defaultValue: null
    });
    // console.log('✅ Added device_id to users table');
  } else {
    // console.log('ℹ️  device_id already exists in users table — skipping');
  }

  await sequelize.close();
  // console.log('\nDone. Single-device login enforcement is ready.');
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
