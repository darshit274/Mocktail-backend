'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add 'previous_years_question_papers' to pricing_type ENUM
     * in new_test_series table
     */
    await queryInterface.sequelize.query(`
      ALTER TABLE new_test_series
      MODIFY COLUMN pricing_type
      ENUM('free', 'paid', 'previous_years_question_papers')
      DEFAULT 'free'
      NOT NULL
      COMMENT 'Type of test series: free, paid, or previous years question papers';
    `);

    // console.log('✅ Successfully added previous_years_question_papers to pricing_type ENUM');
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revert pricing_type ENUM to original values
     * WARNING: If any records use 'previous_years_question_papers',
     * they should be updated to 'free' or 'paid' before rollback
     */
    await queryInterface.sequelize.query(`
      ALTER TABLE new_test_series
      MODIFY COLUMN pricing_type
      ENUM('free', 'paid')
      DEFAULT 'free'
      NOT NULL;
    `);

    // console.log('✅ Reverted pricing_type ENUM to original values');
  }
};
