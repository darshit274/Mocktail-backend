const express = require('express');
const {
  User,
  TestSession,
  LeaderboardEntry,
  UserAnswer,
  TestSeries,
  Test,
  Question,
  ExamCategory,
  sequelize
} = require('../models');

const router = express.Router();

// GET /api/debug/tables - Check what data exists in key tables
router.get('/tables', async (req, res) => {
  try {
    // console.log('📊 Debug: Checking database tables...');

    const results = {
      timestamp: new Date().toISOString(),
      database_info: {},
      table_counts: {},
      sample_records: {}
    };

    // Get database name
    try {
      const [dbResults] = await sequelize.query('SELECT DATABASE() as db_name');
      results.database_info.name = dbResults[0]?.db_name || 'Unknown';
    } catch (error) {
      results.database_info.error = error.message;
    }

    // Check Users table
    try {
      const userCount = await User.count();
      results.table_counts.users = userCount;

      if (userCount > 0) {
        const sampleUsers = await User.findAll({
          limit: 3,
          attributes: ['uuid', 'username', 'email', 'fullName', 'isEmailVerified', 'subscription_status', 'created_at'],
          order: [['created_at', 'DESC']]
        });
        results.sample_records.users = sampleUsers;
      }
    } catch (error) {
      results.table_counts.users = `Error: ${error.message}`;
    }

    // Check Test Sessions
    try {
      const sessionCount = await TestSession.count();
      results.table_counts.test_sessions = sessionCount;

      if (sessionCount > 0) {
        const sampleSessions = await TestSession.findAll({
          limit: 3,
          attributes: [
            'id', 'user_id', 'test_id', 'is_completed', 'is_submitted',
            'status', 'calculated_score', 'total_correct', 'total_wrong',
            'total_unanswered', 'started_at', 'completed_at'
          ],
          order: [['created_at', 'DESC']]
        });
        results.sample_records.test_sessions = sampleSessions;

        // Get completion status breakdown
        const statusBreakdown = await TestSession.findAll({
          attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['status']
        });
        results.table_counts.test_sessions_by_status = statusBreakdown;
      }
    } catch (error) {
      results.table_counts.test_sessions = `Error: ${error.message}`;
    }

    // Check Leaderboard Entries
    try {
      const leaderboardCount = await LeaderboardEntry.count();
      results.table_counts.leaderboard_entries = leaderboardCount;

      if (leaderboardCount > 0) {
        const sampleEntries = await LeaderboardEntry.findAll({
          limit: 3,
          attributes: [
            'id', 'user_id', 'test_id', 'test_session_id', 'score', 'percentage',
            'correct_answers', 'wrong_answers', 'unanswered', 'time_taken_seconds',
            'rank', 'completion_date', 'is_valid'
          ],
          order: [['completion_date', 'DESC']]
        });
        results.sample_records.leaderboard_entries = sampleEntries;
      }
    } catch (error) {
      results.table_counts.leaderboard_entries = `Error: ${error.message}`;
    }

    // Check User Answers
    try {
      const answersCount = await UserAnswer.count();
      results.table_counts.user_answers = answersCount;

      if (answersCount > 0) {
        const sampleAnswers = await UserAnswer.findAll({
          limit: 5,
          attributes: [
            'id', 'test_session_id', 'question_id', 'selected_option',
            'is_correct', 'time_spent', 'is_flagged', 'is_visited'
          ],
          order: [['created_at', 'DESC']]
        });
        results.sample_records.user_answers = sampleAnswers;

        // Get correct/incorrect breakdown
        const correctnessBreakdown = await UserAnswer.findAll({
          attributes: [
            'is_correct',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['is_correct']
        });
        results.table_counts.user_answers_by_correctness = correctnessBreakdown;
      }
    } catch (error) {
      results.table_counts.user_answers = `Error: ${error.message}`;
    }

    // Check Test Series (new system)
    try {
      const seriesCount = await TestSeries.count();
      results.table_counts.new_test_series = seriesCount;

      if (seriesCount > 0) {
        const sampleSeries = await TestSeries.findAll({
          limit: 3,
          attributes: [
            'id', 'uuid', 'name', 'name_gujarati', 'pricing_type', 'price',
            'is_active', 'difficulty_level', 'free_test_count', 'created_at'
          ],
          order: [['created_at', 'DESC']]
        });
        results.sample_records.new_test_series = sampleSeries;
      }
    } catch (error) {
      results.table_counts.new_test_series = `Error: ${error.message}`;
    }

    // Check Tests table (if exists)
    try {
      if (Test) {
        const testCount = await Test.count();
        results.table_counts.tests = testCount;

        if (testCount > 0) {
          const sampleTests = await Test.findAll({
            limit: 3,
            attributes: ['id', 'name', 'duration_minutes', 'total_questions', 'is_active', 'created_at'],
            order: [['created_at', 'DESC']]
          });
          results.sample_records.tests = sampleTests;
        }
      }
    } catch (error) {
      results.table_counts.tests = `Error: ${error.message}`;
    }

    // Check Questions table (if exists)
    try {
      if (Question) {
        const questionCount = await Question.count();
        results.table_counts.questions = questionCount;

        if (questionCount > 0) {
          const sampleQuestions = await Question.findAll({
            limit: 2,
            attributes: ['id', 'question_text', 'question_text_gujarati', 'correct_option', 'marks', 'created_at'],
            order: [['created_at', 'DESC']]
          });
          results.sample_records.questions = sampleQuestions;
        }
      }
    } catch (error) {
      results.table_counts.questions = `Error: ${error.message}`;
    }

    // Check Exam Categories (if exists)
    try {
      if (ExamCategory) {
        const categoryCount = await ExamCategory.count();
        results.table_counts.exam_categories = categoryCount;

        if (categoryCount > 0) {
          const sampleCategories = await ExamCategory.findAll({
            limit: 5,
            attributes: ['id', 'name', 'name_gujarati', 'level', 'parent_id', 'is_active'],
            order: [['created_at', 'DESC']]
          });
          results.sample_records.exam_categories = sampleCategories;
        }
      }
    } catch (error) {
      results.table_counts.exam_categories = `Error: ${error.message}`;
    }

    // console.log('📊 Debug results:', JSON.stringify(results.table_counts, null, 2));
    res.status(200).json(results);

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/debug/user/:userId - Check specific user's quiz data
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // console.log(`📊 Debug: Checking user data for ${userId}...`);

    const results = {
      timestamp: new Date().toISOString(),
      user_id: userId,
      user_info: null,
      quiz_data: {}
    };

    // Get user info (safe fields only)
    try {
      const user = await User.findByPk(userId, {
        attributes: [
          'uuid', 'username', 'email', 'fullName', 'isEmailVerified',
          'subscription_status', 'total_subscriptions', 'created_at', 'lastLogin'
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          user_id: userId
        });
      }

      results.user_info = user;
    } catch (error) {
      results.user_info = { error: error.message };
    }

    // Get user's test sessions
    try {
      const testSessions = await TestSession.findAll({
        where: { user_id: userId },
        attributes: [
          'id', 'test_id', 'is_completed', 'is_submitted', 'status',
          'calculated_score', 'total_correct', 'total_wrong', 'total_unanswered',
          'started_at', 'completed_at', 'remaining_time_seconds'
        ],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      results.quiz_data.test_sessions = {
        count: testSessions.length,
        sessions: testSessions
      };

      // Get session status summary
      const sessionStatusSummary = {};
      testSessions.forEach(session => {
        sessionStatusSummary[session.status] = (sessionStatusSummary[session.status] || 0) + 1;
      });
      results.quiz_data.session_status_summary = sessionStatusSummary;

    } catch (error) {
      results.quiz_data.test_sessions = { error: error.message };
    }

    // Get user's leaderboard entries
    try {
      const leaderboardEntries = await LeaderboardEntry.findAll({
        where: { user_id: userId },
        attributes: [
          'id', 'test_id', 'test_session_id', 'score', 'percentage',
          'correct_answers', 'wrong_answers', 'unanswered',
          'time_taken_seconds', 'rank', 'completion_date', 'is_valid'
        ],
        order: [['completion_date', 'DESC']],
        limit: 10
      });

      results.quiz_data.leaderboard_entries = {
        count: leaderboardEntries.length,
        entries: leaderboardEntries
      };

      if (leaderboardEntries.length > 0) {
        const avgScore = leaderboardEntries.reduce((sum, entry) => sum + parseFloat(entry.score || 0), 0) / leaderboardEntries.length;
        const avgPercentage = leaderboardEntries.reduce((sum, entry) => sum + parseFloat(entry.percentage || 0), 0) / leaderboardEntries.length;

        results.quiz_data.performance_summary = {
          average_score: Math.round(avgScore * 100) / 100,
          average_percentage: Math.round(avgPercentage * 100) / 100,
          total_tests_completed: leaderboardEntries.length,
          best_score: Math.max(...leaderboardEntries.map(e => parseFloat(e.score || 0))),
          best_percentage: Math.max(...leaderboardEntries.map(e => parseFloat(e.percentage || 0)))
        };
      }

    } catch (error) {
      results.quiz_data.leaderboard_entries = { error: error.message };
    }

    // Get user's answers (sample from recent sessions)
    try {
      const recentSessionIds = results.quiz_data.test_sessions?.sessions?.slice(0, 3).map(s => s.id) || [];

      if (recentSessionIds.length > 0) {
        const userAnswers = await UserAnswer.findAll({
          where: { test_session_id: recentSessionIds },
          attributes: [
            'id', 'test_session_id', 'question_id', 'selected_option',
            'is_correct', 'time_spent', 'is_flagged', 'is_visited'
          ],
          order: [['created_at', 'DESC']],
          limit: 20
        });

        results.quiz_data.user_answers = {
          count: userAnswers.length,
          sample_answers: userAnswers
        };

        // Calculate answer statistics
        if (userAnswers.length > 0) {
          const correctAnswers = userAnswers.filter(a => a.is_correct).length;
          const flaggedAnswers = userAnswers.filter(a => a.is_flagged).length;
          const avgTimePerQuestion = userAnswers.reduce((sum, a) => sum + (a.time_spent || 0), 0) / userAnswers.length;

          results.quiz_data.answer_statistics = {
            total_answers: userAnswers.length,
            correct_answers: correctAnswers,
            accuracy_percentage: Math.round((correctAnswers / userAnswers.length) * 100),
            flagged_answers: flaggedAnswers,
            average_time_per_question: Math.round(avgTimePerQuestion)
          };
        }
      }
    } catch (error) {
      results.quiz_data.user_answers = { error: error.message };
    }

    // console.log(`📊 User ${userId} debug results:`, {
//       sessions: results.quiz_data.test_sessions?.count || 0,
//       leaderboard: results.quiz_data.leaderboard_entries?.count || 0,
//       answers: results.quiz_data.user_answers?.count || 0
//     });

    res.status(200).json(results);

  } catch (error) {
    console.error('❌ User debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      user_id: req.params.userId,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/debug/raw-query/:table - Execute raw query to check table structure
router.get('/raw-query/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const limit = req.query.limit || 5;

    // Whitelist allowed tables for security
    const allowedTables = [
      'users', 'test_sessions', 'leaderboard_entries', 'user_answers',
      'new_test_series', 'tests', 'new_tests', 'questions', 'exam_categories'
    ];

    if (!allowedTables.includes(table)) {
      return res.status(400).json({
        success: false,
        error: 'Table not allowed for debug queries',
        allowed_tables: allowedTables
      });
    }

    // Get table structure
    const [tableStructure] = await sequelize.query(`DESCRIBE ${table}`);

    // Get sample data
    const [tableData] = await sequelize.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT ${limit}`);

    // Get total count
    const [countResult] = await sequelize.query(`SELECT COUNT(*) as total_count FROM ${table}`);
    const totalCount = countResult[0]?.total_count || 0;

    res.status(200).json({
      success: true,
      table_name: table,
      total_records: totalCount,
      structure: tableStructure,
      sample_data: tableData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Raw query error for table ${req.params.table}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      table: req.params.table
    });
  }
});

module.exports = router;