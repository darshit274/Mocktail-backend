const express = require('express');
const router = express.Router();
const { TestSession, UserAnswer, LeaderboardEntry, Test, User, NewTest } = require('../models');

/**
 * Temporary API endpoint to simulate a completed quiz session for testing
 * This creates all necessary records to simulate what happens when a user completes a quiz
 */
router.post('/complete-quiz', async (req, res) => {
    try {
        // Parameters - can be overridden by request body
        const {
            userId = '39869106-fd44-437f-9308-54c49e74d119',
            testId = 5,
            testSeriesId = null
        } = req.body;

        // console.log(`Creating simulation for userId: ${userId}, testId: ${testId}, testSeriesId: ${testSeriesId}`);
        const totalQuestions = 2;
        const correctAnswers = 2;
        const percentage = 100;
        const timeTaken = 120; // seconds

        // Find the user, or create a temporary one for testing
        let user = await User.findOne({ where: { uuid: userId } });
        if (!user) {
            // console.log(`User ${userId} not found, creating temporary user for testing`);
            // Create a temporary user for this submission
            const { v4: uuidv4 } = require('uuid');
            user = await User.create({
                uuid: userId, // Use the provided userId as UUID
                username: 'Anonymous User',
                email: `temp-${Date.now()}@test.com`,
                password: 'temp-password',
                isEmailVerified: true,
                role: 'student'
            });
            // console.log(`Created temporary user: ${user.uuid}`);
        }

        // If testSeriesId is provided, create missing test series and test
        let newTest;
        if (testSeriesId) {
            const { TestSeries } = require('../models');

            // Check if test series exists
            let testSeries = await TestSeries.findOne({ where: { uuid: testSeriesId } });
            if (!testSeries) {
                // Create the test series
                testSeries = await TestSeries.create({
                    uuid: testSeriesId,
                    name: 'Veniam consequat C',
                    name_gujarati: 'વેનિયમ કન્સેક્વેટ સી',
                    description: 'Test series created for frontend compatibility',
                    description_gujarati: 'ફ્રંટએન્ડ સુસંગતતા માટે બનાવેલ ટેસ્ટ શ્રેણી',
                    price: 0.00,
                    pricing_type: 'free',
                    difficulty_level: 'beginner',
                    is_active: 1,
                    is_published: 1,
                    published_at: new Date()
                });
                // console.log(`Created test series: ${testSeries.name} (${testSeries.uuid})`);
            }

            // Check if test exists for this series
            newTest = await NewTest.findOne({
                where: { test_series_id: testSeries.id }
            });

            if (!newTest) {
                // Create a test for this series
                const { v4: uuidv4 } = require('uuid');
                newTest = await NewTest.create({
                    uuid: uuidv4(),
                    title: 'Practice Test - Veniam Consequat',
                    title_gujarati: 'પ્રેક્ટિસ ટેસ્ટ - વેનિયમ કન્સેક્વેટ',
                    description: 'A comprehensive test to evaluate your knowledge',
                    description_gujarati: 'તમારા જ્ઞાનનું મૂલ્યાંકન કરવા માટેનો વ્યાપક ટેસ્ટ',
                    test_series_id: testSeries.id,
                    category_id: 1,
                    test_type: 'practice',
                    duration_minutes: 60,
                    total_questions: 2,
                    total_marks: 2,
                    passing_marks: 1,
                    is_free: 1,
                    is_active: 1,
                    is_published: 1,
                    published_at: new Date()
                });
                // console.log(`Created test: ${newTest.title} (ID: ${newTest.id})`);
            }
        } else {
            // Verify the test exists in new_tests (for validation)
            newTest = await NewTest.findByPk(testId);
            if (!newTest) {
                return res.status(404).json({
                    success: false,
                    message: 'Test not found in new_tests'
                });
            }
        }

        // Update testId to use the found/created test
        const finalTestId = newTest.id;

        // Create temporary records to satisfy foreign key constraints
        const { sequelize } = require('../models');

        // Create minimal sub_category if needed
        await sequelize.query(`
            INSERT IGNORE INTO sub_categories (id, uuid, category_id, name, name_gujarati, is_active, created_at, updated_at)
            VALUES (1, 'temp-sub-category', 1, 'Temp Sub Category', 'અસ્થાયી પેટા કેટેગરી', 1, NOW(), NOW())
        `);

        // Create minimal category if needed
        await sequelize.query(`
            INSERT IGNORE INTO categories (id, uuid, name, name_gujarati, is_active, created_at, updated_at)
            VALUES (1, 'temp-category', 'Temp Category', 'અસ્થાયી કેટેગરી', 1, NOW(), NOW())
        `);

        // Create a temporary test record in the old tests table if it doesn't exist
        await sequelize.query(`
            INSERT IGNORE INTO tests (id, uuid, sub_category_id, title, title_gujarati, description,
                                    description_gujarati, duration_minutes, total_marks, is_demo,
                                    is_free_in_paid_series, is_free_in_series, negative_marking_enabled,
                                    negative_marks_per_wrong, is_one_time_only, time_duration_minutes,
                                    passing_marks, instructions, instructions_gujarati, difficulty_level,
                                    randomize_questions, show_results_immediately, pass_percentage,
                                    allow_review, total_questions, display_order, is_active, created_at, updated_at)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 0, 1, 1, 0, 0.00, 0, ?, ?, ?, ?, 'medium',
                    0, 1, 60.00, 1, ?, 1, 1, NOW(), NOW())
        `, {
            replacements: [
                finalTestId,
                newTest.uuid,
                newTest.title || 'Test Title',
                newTest.title_gujarati || 'ટેસ્ટ શીર્ષક',
                newTest.description || 'Test Description',
                newTest.description_gujarati || 'ટેસ્ટ વર્ણન',
                newTest.duration_minutes || 60,
                newTest.total_marks || 2,
                newTest.duration_minutes || 60,
                newTest.passing_marks || 1,
                newTest.instructions || 'Test instructions',
                newTest.instructions_gujarati || 'ટેસ્ટ સૂચનાઓ',
                newTest.total_questions || 2
            ],
            type: sequelize.QueryTypes.INSERT
        });

        // Check if a session already exists for this user and test
        let testSession = await TestSession.findOne({
            where: {
                user_id: userId,
                test_id: finalTestId
            }
        });

        // Create or update the test session
        if (!testSession) {
            testSession = await TestSession.create({
                user_id: userId,
                test_id: finalTestId,
                status: 'completed',
                started_at: new Date(Date.now() - (timeTaken * 1000)), // Simulate start time
                completed_at: new Date(),
                submitted_at: new Date(),
                time_taken: timeTaken,
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
                incorrect_answers: totalQuestions - correctAnswers,
                unanswered: 0,
                percentage: percentage,
                score: correctAnswers,
                is_paused: false,
                current_question_index: totalQuestions - 1
            });
        } else {
            // Update existing session
            await testSession.update({
                status: 'completed',
                completed_at: new Date(),
                submitted_at: new Date(),
                time_taken: timeTaken,
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
                incorrect_answers: totalQuestions - correctAnswers,
                unanswered: 0,
                percentage: percentage,
                score: correctAnswers,
                is_paused: false,
                current_question_index: totalQuestions - 1
            });
        }

        // Create sample user answers to simulate quiz completion
        const sampleAnswers = [
            {
                test_session_id: testSession.id,
                question_id: 1, // Assuming question IDs exist
                selected_option: 'A',
                is_correct: true,
                time_spent: 60,
                is_flagged: false,
                is_visited: true
            },
            {
                test_session_id: testSession.id,
                question_id: 2,
                selected_option: 'B',
                is_correct: true,
                time_spent: 60,
                is_flagged: false,
                is_visited: true
            }
        ];

        // Clear existing answers and create new ones
        await UserAnswer.destroy({
            where: {
                test_session_id: testSession.id
            }
        });

        await UserAnswer.bulkCreate(sampleAnswers);

        // Create or update leaderboard entry
        let leaderboardEntry = await LeaderboardEntry.findOne({
            where: {
                user_id: userId,
                test_id: finalTestId
            }
        });

        if (!leaderboardEntry) {
            leaderboardEntry = await LeaderboardEntry.create({
                user_id: userId,
                test_id: finalTestId,
                test_session_id: testSession.id,
                // test_series_id: newTest.test_series_id, // Temporarily NULL due to foreign key mismatch
                score: correctAnswers,
                percentage: percentage,
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
                wrong_answers: totalQuestions - correctAnswers,
                unanswered: 0,
                time_taken_seconds: timeTaken,
                rank: 1, // Will be recalculated when multiple entries exist
                completion_date: new Date()
            });
        } else {
            await leaderboardEntry.update({
                test_session_id: testSession.id,
                // test_series_id: newTest.test_series_id, // Temporarily NULL due to foreign key mismatch
                score: correctAnswers,
                percentage: percentage,
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
                wrong_answers: totalQuestions - correctAnswers,
                unanswered: 0,
                time_taken_seconds: timeTaken,
                completion_date: new Date()
            });
        }

        // Recalculate ranks for this test
        await recalculateRanks(finalTestId);

        res.json({
            success: true,
            message: 'Quiz simulation completed successfully',
            data: {
                testSession: {
                    id: testSession.id,
                    user_id: userId,
                    test_id: finalTestId,
                    status: testSession.status,
                    score: testSession.score,
                    percentage: testSession.percentage,
                    time_taken: testSession.time_taken,
                    completed_at: testSession.completed_at
                },
                leaderboardEntry: {
                    id: leaderboardEntry.id,
                    user_id: userId,
                    test_id: finalTestId,
                    test_session_id: leaderboardEntry.test_session_id,
                    score: leaderboardEntry.score,
                    percentage: leaderboardEntry.percentage,
                    total_questions: leaderboardEntry.total_questions,
                    correct_answers: leaderboardEntry.correct_answers,
                    wrong_answers: leaderboardEntry.wrong_answers,
                    time_taken_seconds: leaderboardEntry.time_taken_seconds,
                    rank: leaderboardEntry.rank,
                    completion_date: leaderboardEntry.completion_date
                },
                answersCreated: sampleAnswers.length
            }
        });

    } catch (error) {
        console.error('Error in quiz simulation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to simulate quiz completion',
            error: error.message
        });
    }
});

/**
 * Helper function to recalculate ranks for a specific test
 */
async function recalculateRanks(testId) {
    try {
        const leaderboardEntries = await LeaderboardEntry.findAll({
            where: { test_id: testId },
            order: [
                ['percentage', 'DESC'],
                ['time_taken_seconds', 'ASC']
            ]
        });

        // Update ranks
        for (let i = 0; i < leaderboardEntries.length; i++) {
            await leaderboardEntries[i].update({ rank: i + 1 });
        }
    } catch (error) {
        console.error('Error recalculating ranks:', error);
    }
}

/**
 * GET endpoint to check current simulation status
 */
router.get('/status/:userId/:testId', async (req, res) => {
    try {
        const { userId, testId } = req.params;

        const testSession = await TestSession.findOne({
            where: {
                user_id: userId,
                test_id: testId
            }
        });

        const leaderboardEntry = await LeaderboardEntry.findOne({
            where: {
                user_id: userId,
                test_id: testId
            }
        });

        const userAnswers = await UserAnswer.findAll({
            include: [{
                model: require('../models').TestSession,
                as: 'testSession',
                where: {
                    user_id: userId,
                    test_id: testId
                }
            }]
        });

        res.json({
            success: true,
            data: {
                testSession,
                leaderboardEntry,
                answersCount: userAnswers.length
            }
        });

    } catch (error) {
        console.error('Error checking simulation status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check simulation status',
            error: error.message
        });
    }
});

/**
 * DELETE endpoint to clean up simulation data
 */
router.delete('/cleanup/:userId/:testId', async (req, res) => {
    try {
        const { userId, testId } = req.params;

        // Delete user answers
        const testSession = await TestSession.findOne({
            where: { user_id: userId, test_id: testId }
        });

        if (testSession) {
            await UserAnswer.destroy({
                where: {
                    test_session_id: testSession.id
                }
            });
        }

        // Delete test session
        await TestSession.destroy({
            where: {
                user_id: userId,
                test_id: testId
            }
        });

        // Delete leaderboard entry
        await LeaderboardEntry.destroy({
            where: {
                user_id: userId,
                test_id: testId
            }
        });

        res.json({
            success: true,
            message: 'Simulation data cleaned up successfully'
        });

    } catch (error) {
        console.error('Error cleaning up simulation data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clean up simulation data',
            error: error.message
        });
    }
});

module.exports = router;