'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Try to remove the foreign key constraint if it exists
    try {
      await queryInterface.removeConstraint(
        'question_reports',
        'question_reports_ibfk_3'
      );
    } catch (error) {
      // console.log('Constraint question_reports_ibfk_3 does not exist, skipping removal');
    }

    // Change the column type from INTEGER to VARCHAR to support Admin UUIDs
    await queryInterface.changeColumn('question_reports', 'reviewed_by', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Admin UUID who reviewed this report'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert column type back to INTEGER
    await queryInterface.changeColumn('question_reports', 'reviewed_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Admin user ID who reviewed this report'
    });

    // Re-add the foreign key constraint
    await queryInterface.addConstraint('question_reports', {
      fields: ['reviewed_by'],
      type: 'foreign key',
      name: 'question_reports_ibfk_2',
      references: {
        table: 'users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  }
};
