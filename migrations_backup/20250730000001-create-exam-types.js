'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('exam_types', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Exam name (e.g., "Deputy Section Officer", "PSI", "GPSC")'
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Short code for exam (e.g., "DSO", "PSI", "GPSC")'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
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

    // Add some default exam types
    await queryInterface.bulkInsert('exam_types', [
      {
        name: 'Police Sub Inspector',
        code: 'PSI',
        description: 'Gujarat Police Sub Inspector recruitment exam',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Gujarat Public Service Commission',
        code: 'GPSC',
        description: 'Gujarat Public Service Commission various posts',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Deputy Section Officer',
        code: 'DSO',
        description: 'Deputy Section Officer recruitment exam',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('exam_types');
  }
};