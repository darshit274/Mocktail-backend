module.exports = (sequelize, DataTypes) => {
  const Question = sequelize.define('Question', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true
    },
    test_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    question_text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    option_a: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    option_b: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    option_c: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    option_d: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    correct_answer: {
      type: DataTypes.ENUM('A', 'B', 'C', 'D'),
      allowNull: false
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    marks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'questions',
    underscored: true,
    timestamps: true
  });

  Question.associate = function(models) {
    Question.belongsTo(models.Test, { 
      foreignKey: 'test_id', 
      as: 'test' 
    });
  };

  return Question;
};