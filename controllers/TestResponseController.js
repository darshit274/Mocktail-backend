const {
  TestSession,
  UserAnswer,
  LeaderboardEntry,
  Test,
  Question,
  User,
  TestSeries,
  Category,
  DynamicCategory
} = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

class TestResponseController {
  // =====================
  // TEST SESSION MANAGEMENT
  // =====================

  // Start a new test session
  async startTestSession(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { test_id, user_id } = req.body;

      // Validate required fields
      if (!test_id || !user_id) {
        return res.status(400).json({
          success: false,
          message: 'Test ID and User ID are required'
        });
      }

      // Check if test exists and get test details
      const test = await Test.findByPk(test_id, {
        include: [{
          model: Question,
          as: 'questions',
          attributes: ['id', 'uuid', 'question_text', 'marks', 'time_to_solve_seconds']
        }]
      });

      if (!test) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }

      // Check if user already has an active session for this test
      const existingSession = await TestSession.findOne({
        where: {
          user_id,
          test_id,
          status: { [Op.in]: ['active', 'paused'] }
        },
        transaction
      });

      if (existingSession) {
        await transaction.commit();
        return res.status(200).json({
          success: true,
          message: 'Test session already exists',
          data: existingSession
        });
      }

      // Create new test session
      const testSession = await TestSession.create({
        user_id,
        test_id,
        started_at: new Date(),
        total_questions: test.questions?.length || 0,
        remaining_time_seconds: test.duration_minutes * 60,
        session_data: {
          questions: test.questions?.map(q => ({
            id: q.id,
            uuid: q.uuid,
            visited: false,
            answered: false,
            flagged: false,
            time_spent: 0
          })) || []
        },
        status: 'active'
      }, { transaction });

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: 'Test session started successfully',
        data: {
          session: testSession,
          test: {
            id: test.id,
            name: test.title,
            duration_minutes: test.duration_minutes,
            total_questions: test.questions?.length || 0,
            instructions: test.instructions
          }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Start test session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Save answer for a question
  async saveAnswer(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { test_session_id, question_id, selected_option, time_spent, is_flagged } = req.body;

      // Validate required fields
      if (!test_session_id || !question_id) {
        return res.status(400).json({
          success: false,
          message: 'Test session ID and question ID are required'
        });
      }

      // Get test session and verify it's active
      const testSession = await TestSession.findByPk(test_session_id, { transaction });
      if (!testSession || !['active', 'paused'].includes(testSession.status)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive test session'
        });
      }

      // Get question to check correct answer
      const question = await Question.findByPk(question_id);
      if (!question) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      // Calculate if answer is correct
      const isCorrect = selected_option && selected_option === question.correct_answer;

      // Create or update user answer
      const [userAnswer, created] = await UserAnswer.findOrCreate({
        where: {
          test_session_id,
          question_id
        },
        defaults: {
          selected_option,
          is_correct: isCorrect,
          time_spent: time_spent || 0,
          is_flagged: is_flagged || false,
          is_visited: true
        },
        transaction
      });

      if (!created) {
        // Update existing answer
        await userAnswer.update({
          selected_option,
          is_correct: isCorrect,
          time_spent: time_spent || userAnswer.time_spent,
          is_flagged: is_flagged !== undefined ? is_flagged : userAnswer.is_flagged,
          is_visited: true
        }, { transaction });
      }

      // Update session data
      const sessionData = testSession.session_data || { questions: [] };
      const questionIndex = sessionData.questions.findIndex(q => q.id === question_id);
      
      if (questionIndex !== -1) {
        sessionData.questions[questionIndex] = {
          ...sessionData.questions[questionIndex],
          visited: true,
          answered: !!selected_option,
          flagged: is_flagged || false,
          time_spent: time_spent || 0
        };
      }

      await testSession.update({
        session_data: sessionData
      }, { transaction });

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: 'Answer saved successfully',
        data: {
          user_answer: userAnswer,
          is_correct: isCorrect
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Save answer error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Submit test and calculate final score
  async submitTest(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { test_session_id } = req.body;

      if (!test_session_id) {
        return res.status(400).json({
          success: false,
          message: 'Test session ID is required'
        });
      }

      // Get test session with related data
      const testSession = await TestSession.findByPk(test_session_id, {
        include: [
          {
            model: Test,
            as: 'test',
            include: [
              {
                model: Question,
                as: 'questions'
              },
              {
                model: TestSeries,
                as: 'testSeries'
              },
              {
                model: Category,
                as: 'category'
              }
            ]
          },
          {
            model: User,
            as: 'user'
          }
        ],
        transaction
      });

      if (!testSession) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Test session not found'
        });
      }

      if (testSession.is_submitted) {
        await transaction.commit();
        return res.status(200).json({
          success: true,
          message: 'Test already submitted',
          data: await this.getTestResults(test_session_id)
        });
      }

      // Get all user answers for this session
      const userAnswers = await UserAnswer.findAll({
        where: { test_session_id },
        include: [{
          model: Question,
          as: 'question'
        }],
        transaction
      });

      // Calculate scores
      const results = await this.calculateTestResults(testSession, userAnswers, transaction);
      
      // Update test session with results
      await testSession.update({
        is_completed: true,
        is_submitted: true,
        completed_at: new Date(),
        status: 'completed',
        calculated_score: results.finalScore,
        total_correct: results.correctAnswers,
        total_wrong: results.wrongAnswers,
        total_unanswered: results.unanswered,
        total_marked_for_review: results.flaggedQuestions
      }, { transaction });

      // Create leaderboard entry
      await this.createLeaderboardEntry(testSession, results, transaction);

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: 'Test submitted successfully',
        data: {
          session: testSession,
          results: results
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Submit test error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // =====================
  // HELPER FUNCTIONS
  // =====================

  async calculateTestResults(testSession, userAnswers, transaction) {
    const test = testSession.test;

    // console.log('🎯 CALCULATE TEST RESULTS DEBUG:', {
//       test_id: test?.id,
//       test_title: test?.title,
//       test_negative_marking: test?.negative_marking_enabled,
//       test_series_id: test?.testSeries?.id,
//       test_series_name: test?.testSeries?.name,
//       test_series_negative_marking: test?.testSeries?.has_negative_marking,
//       test_series_negative_marks: test?.testSeries?.negative_marks
//     });
    const totalQuestions = test.questions?.length || 0;
    
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unanswered = 0;
    let flaggedQuestions = 0;
    let totalMarks = 0;
    let obtainedMarks = 0;
    let negativeMarks = 0;

    // Calculate results from user answers
    const answeredQuestionIds = userAnswers.map(ua => ua.question_id);
    
    // Process each user answer (using for...of to handle async operations)
    for (const userAnswer of userAnswers) {
      if (userAnswer.is_flagged) flaggedQuestions++;

      if (!userAnswer.selected_option) {
        unanswered++;
      } else if (userAnswer.is_correct) {
        correctAnswers++;
        obtainedMarks += userAnswer.question?.marks || 1;
      } else {
        wrongAnswers++;

        // Check negative marking - Priority: Category Level → Test Level → Default
        let hasNegativeMarking = false;
        let negativeMarkValue = 0.25; // Default value

        // First, check if question belongs to a Category with negative marking
        if (userAnswer.question?.category_id) {
          const category = await Category.findByPk(userAnswer.question.category_id);
          if (category && category.negative_marking_enabled) {
            hasNegativeMarking = true;
            negativeMarkValue = category.negative_marks_per_wrong || 0.25;
          }
        }

        // Fall back to test-level negative marking if no category setting
        if (!hasNegativeMarking && test.negative_marking_enabled) {
          hasNegativeMarking = true;
          negativeMarkValue = test.negative_marks_per_wrong || 0.25;
        }

        // console.log('🔍 NEGATIVE MARKING DEBUG:', {
//           question_id: userAnswer.question?.id,
//           category_id: userAnswer.question?.category_id,
//           test_negative_marking: test.negative_marking_enabled,
//           hasNegativeMarking,
//           negativeMarkValue,
//           wrongAnswers
//         });

        if (hasNegativeMarking) {
          negativeMarks += parseFloat(negativeMarkValue);
          // console.log('✅ Applied negative marking:', negativeMarks);
        } else {
          // console.log('❌ No negative marking applied');
        }
      }

      totalMarks += userAnswer.question?.marks || 1;
    }

    // Count questions that were never answered
    const allQuestionIds = test.questions?.map(q => q.id) || [];
    const unansweredCount = allQuestionIds.filter(id => !answeredQuestionIds.includes(id)).length;
    unanswered += unansweredCount;

    // Calculate final score
    const finalScore = Math.max(0, obtainedMarks - negativeMarks);
    const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;

    // Calculate time taken
    const timeTakenSeconds = Math.floor((new Date() - new Date(testSession.started_at)) / 1000);

    return {
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      unanswered,
      flaggedQuestions,
      totalMarks,
      obtainedMarks,
      negativeMarks,
      finalScore,
      percentage: Math.round(percentage * 100) / 100,
      timeTakenSeconds
    };
  }

  async createLeaderboardEntry(testSession, results, transaction) {
    const leaderboardEntry = await LeaderboardEntry.create({
      user_id: testSession.user_id,
      test_id: testSession.test_id,
      test_session_id: testSession.id,
      test_series_id: null, // Set to NULL due to foreign key constraint mismatch
      category_id: testSession.test?.category_id || null,
      score: results.finalScore,
      percentage: results.percentage,
      total_questions: results.totalQuestions,
      correct_answers: results.correctAnswers,
      wrong_answers: results.wrongAnswers,
      unanswered: results.unanswered,
      time_taken_seconds: results.timeTakenSeconds,
      completion_date: new Date(),
      is_valid: true
    }, { transaction });

    // Calculate rank and percentile (will be updated by a background job)
    await this.updateRankingsForTest(testSession.test_id, transaction);

    return leaderboardEntry;
  }

  async updateRankingsForTest(testId, transaction) {
    // Get all leaderboard entries for this test, ordered by score desc, time asc
    const entries = await LeaderboardEntry.findAll({
      where: { 
        test_id: testId,
        is_valid: true
      },
      order: [
        ['score', 'DESC'],
        ['time_taken_seconds', 'ASC'],
        ['completion_date', 'ASC']
      ],
      transaction
    });

    // Update ranks
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rank = i + 1;
      const percentile = entries.length > 1 ? 
        Math.round(((entries.length - rank) / (entries.length - 1)) * 100 * 100) / 100 : 100;

      await entry.update({
        rank,
        percentile
      }, { transaction });
    }
  }

  // =====================
  // LEADERBOARD APIs
  // =====================

  // Get leaderboard for a specific test
  async getTestLeaderboard(req, res) {
    try {
      const { test_id } = req.params;
      const { page = 1, limit = 50, user_id } = req.query;
      const offset = (page - 1) * limit;

      const leaderboard = await LeaderboardEntry.findAndCountAll({
        where: { 
          test_id,
          is_valid: true
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['uuid', 'username', 'fullName', 'avatarUrl']
          },
          {
            model: Test,
            as: 'test',
            attributes: ['id', 'title', 'duration_minutes']
          }
        ],
        order: [
          ['rank', 'ASC']
        ],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Get user's rank if user_id is provided
      let userRank = null;
      if (user_id) {
        const userEntry = await LeaderboardEntry.findOne({
          where: {
            test_id,
            user_id,
            is_valid: true
          },
          attributes: ['rank', 'score', 'percentage', 'percentile']
        });
        userRank = userEntry;
      }

      res.status(200).json({
        success: true,
        message: 'Test leaderboard retrieved successfully',
        data: {
          leaderboard: leaderboard.rows,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(leaderboard.count / limit),
            totalEntries: leaderboard.count,
            limit: parseInt(limit)
          },
          userRank
        }
      });

    } catch (error) {
      console.error('Get test leaderboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get leaderboard for a test series
  async getTestSeriesLeaderboard(req, res) {
    try {
      const { test_series_id } = req.params;
      const { page = 1, limit = 50, user_id } = req.query;
      const offset = (page - 1) * limit;

      // Get aggregated scores for test series
      const leaderboard = await sequelize.query(`
        SELECT 
          le.user_id,
          u.username,
          u.fullName,
          u.avatarUrl,
          COUNT(*) as tests_taken,
          AVG(le.score) as avg_score,
          AVG(le.percentage) as avg_percentage,
          SUM(le.score) as total_score,
          AVG(le.time_taken_seconds) as avg_time_taken,
          MAX(le.completion_date) as last_test_date
        FROM leaderboard_entries le
        JOIN users u ON le.user_id = u.uuid
        WHERE le.test_series_id = :testSeriesId AND le.is_valid = 1
        GROUP BY le.user_id, u.username, u.fullName, u.avatarUrl
        ORDER BY total_score DESC, avg_time_taken ASC
        LIMIT :limit OFFSET :offset
      `, {
        replacements: { 
          testSeriesId: test_series_id, 
          limit: parseInt(limit), 
          offset: parseInt(offset) 
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Get total count
      const totalCount = await sequelize.query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM leaderboard_entries 
        WHERE test_series_id = :testSeriesId AND is_valid = 1
      `, {
        replacements: { testSeriesId: test_series_id },
        type: sequelize.QueryTypes.SELECT
      });

      // Add ranks
      const rankedLeaderboard = leaderboard.map((entry, index) => ({
        ...entry,
        rank: offset + index + 1
      }));

      // Get user's position if user_id is provided
      let userRank = null;
      if (user_id) {
        const userPosition = await sequelize.query(`
          SELECT 
            user_id,
            COUNT(*) as tests_taken,
            AVG(score) as avg_score,
            AVG(percentage) as avg_percentage,
            SUM(score) as total_score,
            (
              SELECT COUNT(*) + 1 
              FROM (
                SELECT user_id, SUM(score) as user_total
                FROM leaderboard_entries 
                WHERE test_series_id = :testSeriesId AND is_valid = 1
                GROUP BY user_id
                HAVING user_total > (
                  SELECT SUM(score)
                  FROM leaderboard_entries
                  WHERE test_series_id = :testSeriesId AND user_id = :userId AND is_valid = 1
                )
              ) as better_users
            ) as rank
          FROM leaderboard_entries
          WHERE test_series_id = :testSeriesId AND user_id = :userId AND is_valid = 1
          GROUP BY user_id
        `, {
          replacements: { testSeriesId: test_series_id, userId: user_id },
          type: sequelize.QueryTypes.SELECT
        });
        
        userRank = userPosition[0] || null;
      }

      res.status(200).json({
        success: true,
        message: 'Test series leaderboard retrieved successfully',
        data: {
          leaderboard: rankedLeaderboard,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount[0].count / limit),
            totalEntries: totalCount[0].count,
            limit: parseInt(limit)
          },
          userRank
        }
      });

    } catch (error) {
      console.error('Get test series leaderboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get user's test history and performance
  async getUserTestHistory(req, res) {
    try {
      const { user_id } = req.params;
      const { page = 1, limit = 20, test_series_id } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = { 
        user_id,
        is_valid: true
      };

      if (test_series_id) {
        whereClause.test_series_id = test_series_id;
      }

      const history = await LeaderboardEntry.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Test,
            as: 'test',
            attributes: ['id', 'title', 'duration_minutes'],
            include: [{
              model: TestSeries,
              as: 'testSeries',
              attributes: ['id', 'name']
            }]
          }
        ],
        order: [
          ['completion_date', 'DESC']
        ],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Calculate overall statistics
      const stats = await LeaderboardEntry.findOne({
        where: { user_id, is_valid: true },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_tests'],
          [sequelize.fn('AVG', sequelize.col('score')), 'avg_score'],
          [sequelize.fn('AVG', sequelize.col('percentage')), 'avg_percentage'],
          [sequelize.fn('MAX', sequelize.col('score')), 'best_score'],
          [sequelize.fn('MIN', sequelize.col('score')), 'worst_score'],
          [sequelize.fn('AVG', sequelize.col('rank')), 'avg_rank'],
          [sequelize.fn('MIN', sequelize.col('rank')), 'best_rank']
        ],
        raw: true
      });

      res.status(200).json({
        success: true,
        message: 'User test history retrieved successfully',
        data: {
          history: history.rows,
          statistics: {
            total_tests: stats?.total_tests || 0,
            avg_score: Math.round((stats?.avg_score || 0) * 100) / 100,
            avg_percentage: Math.round((stats?.avg_percentage || 0) * 100) / 100,
            best_score: stats?.best_score || 0,
            worst_score: stats?.worst_score || 0,
            avg_rank: Math.round(stats?.avg_rank || 0),
            best_rank: stats?.best_rank || 0
          },
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(history.count / limit),
            totalEntries: history.count,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get user test history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get test results for a specific session
  async getTestResults(sessionId) {
    try {
      const testSession = await TestSession.findByPk(sessionId, {
        include: [
          {
            model: Test,
            as: 'test',
            attributes: ['id', 'title', 'duration_minutes', 'negative_marking_enabled', 'negative_marks_per_wrong'],
            include: [
              {
                model: TestSeries,
                as: 'testSeries',
                attributes: ['id', 'name', 'has_negative_marking', 'negative_marks']
              }
            ]
          },
          {
            model: User,
            as: 'user',
            attributes: ['uuid', 'username', 'fullName']
          }
        ]
      });

      if (!testSession) {
        return null;
      }

      const leaderboardEntry = await LeaderboardEntry.findOne({
        where: { test_session_id: sessionId }
      });

      const userAnswers = await UserAnswer.findAll({
        where: { test_session_id: sessionId },
        include: [{
          model: Question,
          as: 'question',
          attributes: ['id', 'question_text', 'correct_answer', 'explanation', 'marks']
        }]
      });

      return {
        session: testSession,
        leaderboard_entry: leaderboardEntry,
        answers: userAnswers
      };

    } catch (error) {
      console.error('Get test results error:', error);
      return null;
    }
  }
}

module.exports = new TestResponseController();