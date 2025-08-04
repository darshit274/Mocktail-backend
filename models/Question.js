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
      unique: true,
      allowNull: false
    },
    
    // Association
    test_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    
    // Question content (English - primary)
    question: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    options: {
      type: DataTypes.JSON,
      allowNull: false
    },
    correct_option: {
      type: DataTypes.STRING(1),
      allowNull: false
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Question content (Gujarati)
    question_gujarati: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    options_gujarati: {
      type: DataTypes.JSON,
      allowNull: true
    },
    explanation_gujarati: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Question metadata
    subject: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    topic: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    sub_topic: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard', 'expert'),
      defaultValue: 'medium'
    },
    
    // Marking
    marks: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    negative_marks: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0
    },
    
    // Media support
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    audio_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    
    // Question behavior
    time_limit: {
      type: DataTypes.INTEGER
    },
    is_mandatory: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Display and ordering
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    // Analytics (updated via triggers/jobs)
    total_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    correct_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    average_time: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    // Admin tracking
    created_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'questions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Define associations
  Question.associate = function(models) {
    // Test association
    Question.belongsTo(models.Test, {
      foreignKey: 'test_id',
      as: 'test'
    });

    // Admin who created this question
    Question.belongsTo(models.Admin, {
      foreignKey: 'created_by',
      as: 'creator'
    });

    // User answers for this question (commented out until UserAnswer model is created)
    // Question.hasMany(models.UserAnswer, {
    //   foreignKey: 'question_id',
    //   as: 'userAnswers'
    // });

    // Analytics (commented out until TestAnalytics model is created)
    // Question.hasMany(models.TestAnalytics, {
    //   foreignKey: 'question_id',
    //   as: 'analytics'
    // });
  };

  return Question;
};