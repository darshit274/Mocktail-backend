const express = require('express');
const router = express.Router();
const { TestSession, Test, Category, SubCategory, TestSeries, Question, User, UserAnswer, sequelize } = require('../models');
const { Op } = require('sequelize');
const AuthToken = require('../utils/AuthToken');

// console.log('🚀 Test History Routes loaded successfully!');

// Middleware for required authentication
const requireAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const decoded = AuthToken.verifyToken(token);
        const userUuid = decoded.uuid || decoded.id;
        const user = await User.findOne({ where: { uuid: userUuid } });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        req.user = {
            ...user.toJSON(),
            id: user.uuid,
            uuid: user.uuid
        };

        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

/**
 * Get user test history list - GROUPED BY TEST
 * GET /api/test-history
 * Query params: ?page=1&limit=10&sort=date_desc
 *
 * This returns ONE entry per unique test, showing:
 * - Latest attempt details
 * - Total attempts count
 * - Best score achieved
 * - Latest attempt date
 *
 * Requires authentication - user ID extracted from JWT token
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uuid;
        const { page = 1, limit = 10, sort = 'date_desc' } = req.query;

        // console.log(`📚 Fetching GROUPED test history for user: ${userId}`);

        // First, get all sessions to check which system they belong to
        const allSessions = await TestSession.findAll({
            where: {
                user_id: userId,
                status: 'completed',
                is_completed: true
            },
            attributes: [
                'id', 'test_id', 'completed_at', 'started_at',
                'calculated_score', 'total_questions',
                'total_correct', 'total_wrong', 'total_unanswered',
                'test_name', 'category_name', 'session_data' // session_data contains category UUID
            ],
            order: [['completed_at', 'DESC']]
        });

        // Group sessions by category UUID from session_data
        const groupedTests = {};
        const categoryCache = {}; // Cache category lookups

        for (const session of allSessions) {
            // Check if this is from the new DynamicCategory system
            let categoryUuid = session.session_data?.category_uuid;

            // For OLD tests without session_data, try to find category UUID from Test → Category → TestSeries
            if (!categoryUuid && session.test_id) {
                const oldTest = await Test.findByPk(session.test_id, {
                    include: [{
                        model: SubCategory,
                        as: 'subCategory',
                        include: [{
                            model: Category,
                            as: 'category',
                            include: [{
                                model: TestSeries,
                                as: 'testSeries',
                                attributes: ['uuid']
                            }]
                        }]
                    }]
                });

                // The TestSeries UUID IS the category UUID in the old system!
                if (oldTest?.subCategory?.category?.testSeries?.uuid) {
                    categoryUuid = oldTest.subCategory.category.testSeries.uuid;
                }
            }

            // Use category UUID as grouping key if available, otherwise fall back to test_id
            const groupKey = categoryUuid || session.test_id;

            if (!groupedTests[groupKey]) {
                // Try to get Category info if UUID exists
                let categoryInfo = null;
                if (categoryUuid) {
                    // Check cache first
                    if (!categoryCache[categoryUuid]) {
                        categoryCache[categoryUuid] = await Category.findOne({
                            where: { uuid: categoryUuid, is_active: true },
                            include: [{
                                model: TestSeries,
                                as: 'testSeries',
                                attributes: ['id', 'uuid', 'name', 'name_gujarati', 'pricing_type']
                            }],
                            attributes: [
                                'id', 'uuid', 'name', 'name_gujarati', 'description',
                                'description_gujarati', 'hierarchy_level', 'parent_category_id',
                                'test_series_id', 'is_free_in_paid_series'
                            ]
                        });
                    }
                    categoryInfo = categoryCache[categoryUuid];
                }

                // Build hierarchy if we have category info
                let hierarchyPath = 'General';
                let testName = 'Quiz Test';
                let testNameGujarati = null;
                let testSeriesName = 'General';
                let testSeriesNameGujarati = null;
                let testSeriesUuid = null;
                let pricingType = 'free';
                let isFreeInPaidSeries = false;

                if (categoryInfo) {
                    testName = categoryInfo.name;
                    testNameGujarati = categoryInfo.name_gujarati;
                    testSeriesName = categoryInfo.testSeries?.name || 'General';
                    testSeriesNameGujarati = categoryInfo.testSeries?.name_gujarati;
                    testSeriesUuid = categoryInfo.testSeries?.uuid;
                    pricingType = categoryInfo.testSeries?.pricing_type || 'free';
                    isFreeInPaidSeries = categoryInfo.is_free_in_paid_series || false;

                    // Build breadcrumb hierarchy
                    const hierarchyParts = [];
                    if (categoryInfo.testSeries?.name) {
                        hierarchyParts.push(categoryInfo.testSeries.name);
                    }

                    // Build parent hierarchy
                    let currentParentId = categoryInfo.parent_category_id;
                    const parentNames = [];
                    while (currentParentId) {
                        const parent = await Category.findByPk(currentParentId, {
                            attributes: ['id', 'name', 'parent_category_id']
                        });
                        if (parent) {
                            parentNames.unshift(parent.name);
                            currentParentId = parent.parent_category_id;
                        } else {
                            break;
                        }
                    }
                    hierarchyParts.push(...parentNames);
                    hierarchyParts.push(categoryInfo.name);

                    hierarchyPath = hierarchyParts.join(' → ');
                }

                groupedTests[groupKey] = {
                    testId: groupKey,
                    categoryUuid: categoryUuid,
                    testName: testName,
                    testNameGujarati: testNameGujarati,
                    testUuid: categoryUuid,
                    // Hierarchy information
                    testSeriesName: testSeriesName,
                    testSeriesNameGujarati: testSeriesNameGujarati,
                    testSeriesUuid: testSeriesUuid,
                    categoryName: testName, // Same as test name in new system
                    categoryNameGujarati: testNameGujarati,
                    categoryUuid: categoryUuid,
                    subCategoryName: null,
                    subCategoryUuid: null,
                    hierarchyPath: hierarchyPath,
                    isFreeInPaidSeries: isFreeInPaidSeries,
                    pricingType: pricingType,
                    // Attempt tracking
                    attempts: [],
                    latestAttempt: null,
                    bestScore: 0,
                    bestPercentage: 0,
                    totalAttempts: 0
                };
            }

            // ✅ Calculate accuracy correctly: (correct / attempted) × 100
            const attempted = session.total_correct + session.total_wrong;
            const percentage = attempted > 0
                ? Math.round((session.total_correct / attempted) * 100)
                : 0;

            // Calculate time taken for this session
            const timeSpentSeconds = session.started_at && session.completed_at
                ? Math.floor((new Date(session.completed_at) - new Date(session.started_at)) / 1000)
                : 0;
            const minutes = Math.floor(timeSpentSeconds / 60);
            const seconds = timeSpentSeconds % 60;
            const timeTaken = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // Add this session to attempts
            groupedTests[groupKey].attempts.push({
                sessionId: session.id,
                completedAt: session.completed_at,
                score: parseFloat(session.calculated_score || 0),
                percentage: percentage,
                totalQuestions: session.total_questions,
                correct: session.total_correct,
                wrong: session.total_wrong
            });

            // Update best score if this is better
            if (percentage > groupedTests[groupKey].bestPercentage) {
                groupedTests[groupKey].bestScore = parseFloat(session.calculated_score || 0);
                groupedTests[groupKey].bestPercentage = percentage;
            }

            // Set latest attempt (first one due to DESC order)
            if (!groupedTests[groupKey].latestAttempt) {
                groupedTests[groupKey].latestAttempt = {
                    sessionId: session.id,
                    completedAt: session.completed_at,
                    score: parseFloat(session.calculated_score || 0),
                    percentage: percentage,
                    totalQuestions: session.total_questions,
                    attempted: session.total_correct + session.total_wrong,
                    timeTaken: timeTaken
                };
            }

            groupedTests[groupKey].totalAttempts++;
        }

        // Convert to array and sort
        let groupedArray = Object.values(groupedTests);

        // Sort by latest attempt date
        if (sort === 'date_asc') {
            groupedArray.sort((a, b) => new Date(a.latestAttempt.completedAt) - new Date(b.latestAttempt.completedAt));
        } else {
            groupedArray.sort((a, b) => new Date(b.latestAttempt.completedAt) - new Date(a.latestAttempt.completedAt));
        }

        // Paginate
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const total = groupedArray.length;
        const totalPages = Math.ceil(total / parseInt(limit));
        const paginatedTests = groupedArray.slice(offset, offset + parseInt(limit));

        // Format response
        const formattedHistory = paginatedTests.map(test => ({
            // Test identification
            testId: test.testId,
            testName: test.testName,
            testNameGujarati: test.testNameGujarati,
            testUuid: test.testUuid,
            // Full hierarchy information
            testSeriesName: test.testSeriesName,
            testSeriesNameGujarati: test.testSeriesNameGujarati,
            testSeriesUuid: test.testSeriesUuid,
            categoryName: test.categoryName,
            categoryNameGujarati: test.categoryNameGujarati,
            categoryUuid: test.categoryUuid,
            subCategoryName: test.subCategoryName,
            subCategoryUuid: test.subCategoryUuid,
            hierarchyPath: test.hierarchyPath,
            // Access information
            isFreeInPaidSeries: test.isFreeInPaidSeries,
            pricingType: test.pricingType,
            // Latest attempt info
            latestSessionId: test.latestAttempt.sessionId,
            completedAt: test.latestAttempt.completedAt,
            latestScore: test.latestAttempt.score,
            latestPercentage: test.latestAttempt.percentage,
            // Best score info
            bestScore: test.bestScore,
            bestPercentage: test.bestPercentage,
            // Attempt count
            totalAttempts: test.totalAttempts,
            // Additional info
            totalQuestions: test.latestAttempt.totalQuestions,
            attempted: test.latestAttempt.attempted,
            // Timing
            timeTaken: test.latestAttempt.timeTaken
        }));

        res.json({
            success: true,
            message: 'Test history retrieved successfully (grouped by test)',
            data: {
                history: formattedHistory,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: totalPages,
                    total: total
                },
                note: 'Each entry represents a unique test. Use totalAttempts to see how many times the user took each test.'
            }
        });

    } catch (error) {
        console.error('Test history list error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve test history',
            error: error.message
        });
    }
});

/**
 * Get all attempts for a specific test (grouped by category UUID)
 * GET /api/test-history/test/:testId/attempts
 * Returns all attempts the user made on this specific test/category
 * testId can be either a category UUID or a numeric test_id (for backward compatibility)
 */
router.get('/test/:testId/attempts', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uuid;
        const { testId } = req.params;

        // console.log(`📊 Fetching all attempts for test ${testId} by user: ${userId}`);

        // Check if testId is a UUID (category UUID) or numeric (old test_id)
        const isUuid = testId.includes('-') && testId.length > 10;

        let sessions = [];
        let testName = 'Quiz Test';
        let testUuid = null;

        if (isUuid) {
            // NEW SYSTEM: testId is a category UUID
            // console.log(`🆕 Searching by category UUID: ${testId}`);

            // Get all sessions where session_data.category_uuid matches
            const allUserSessions = await TestSession.findAll({
                where: {
                    user_id: userId,
                    status: 'completed',
                    is_completed: true
                },
                attributes: [
                    'id', 'test_id', 'completed_at', 'started_at',
                    'calculated_score', 'total_questions',
                    'total_correct', 'total_wrong', 'total_unanswered',
                    'session_data'
                ],
                order: [['completed_at', 'DESC']]
            });

            // Filter sessions that match this category UUID
            sessions = allUserSessions.filter(session => {
                return session.session_data?.category_uuid === testId;
            });

            // Also check for old tests that might belong to this category
            const oldTests = await Test.findAll({
                include: [{
                    model: SubCategory,
                    as: 'subCategory',
                    include: [{
                        model: Category,
                        as: 'category',
                        include: [{
                            model: TestSeries,
                            as: 'testSeries',
                            where: { uuid: testId },
                            attributes: ['uuid', 'name']
                        }]
                    }]
                }]
            });

            // If found old tests, add their sessions too
            if (oldTests.length > 0) {
                const oldTestIds = oldTests.map(t => t.id);
                const oldSessions = allUserSessions.filter(session =>
                    oldTestIds.includes(session.test_id) && !session.session_data?.category_uuid
                );
                sessions.push(...oldSessions);

                // Get test name from TestSeries
                testName = oldTests[0]?.subCategory?.category?.testSeries?.name || testName;
            }

            // Try to get category name
            const category = await Category.findOne({
                where: { uuid: testId },
                attributes: ['name', 'uuid']
            });

            if (category) {
                testName = category.name;
                testUuid = category.uuid;
            }

        } else {
            // OLD SYSTEM: testId is a numeric test_id
            // console.log(`🔙 Searching by numeric test_id: ${testId}`);

            sessions = await TestSession.findAll({
                where: {
                    user_id: userId,
                    test_id: testId,
                    status: 'completed',
                    is_completed: true
                },
                attributes: [
                    'id', 'completed_at', 'started_at',
                    'calculated_score', 'total_questions',
                    'total_correct', 'total_wrong', 'total_unanswered',
                    'session_data'
                ],
                include: [{
                    model: Test,
                    as: 'test',
                    attributes: ['id', 'title', 'uuid']
                }],
                order: [['completed_at', 'DESC']]
            });

            if (sessions.length > 0 && sessions[0].test) {
                testName = sessions[0].test.title;
                testUuid = sessions[0].test.uuid;
            }
        }

        if (sessions.length === 0) {
            return res.json({
                success: true,
                message: 'No attempts found for this test',
                data: {
                    testId: testId,
                    testName: testName,
                    attempts: []
                }
            });
        }

        // Format all attempts
        const attempts = sessions.map((session, index) => {
            const timeSpentSeconds = session.started_at && session.completed_at
                ? Math.floor((new Date(session.completed_at) - new Date(session.started_at)) / 1000)
                : 0;

            const minutes = Math.floor(timeSpentSeconds / 60);
            const seconds = timeSpentSeconds % 60;

            const attempted = session.total_correct + session.total_wrong;
            // ✅ Calculate accuracy correctly: (correct / attempted) × 100
            const percentage = attempted > 0
                ? Math.round((session.total_correct / attempted) * 100)
                : 0;

            return {
                attemptNumber: sessions.length - index, // Most recent = highest number
                sessionId: session.id,
                completedAt: session.completed_at,
                score: parseFloat(session.calculated_score || 0),
                percentage: percentage,
                totalQuestions: session.total_questions,
                attempted: attempted,
                correct: session.total_correct,
                wrong: session.total_wrong,
                unanswered: session.total_unanswered,
                timeTaken: `${minutes}:${seconds.toString().padStart(2, '0')}`
            };
        });

        res.json({
            success: true,
            message: 'All attempts retrieved successfully',
            data: {
                testId: testId,
                testName: testName,
                testUuid: testUuid || testId,
                totalAttempts: attempts.length,
                attempts: attempts
            }
        });

    } catch (error) {
        console.error('Get test attempts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve test attempts',
            error: error.message
        });
    }
});

/**
 * Get detailed test result for a specific session
 * GET /api/test-history/:sessionId
 * Requires authentication - user ID extracted from JWT token
 */
router.get('/:sessionId', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uuid;
        const { sessionId } = req.params;

        // console.log(`📊 Fetching detailed result for session: ${sessionId}`);

        // Fetch session with all details - must belong to authenticated user
        const session = await TestSession.findOne({
            where: {
                id: sessionId,
                user_id: userId
            },
            include: [{
                model: Test,
                as: 'test',
                attributes: ['id', 'title', 'uuid']
            }]
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Test session not found or access denied'
            });
        }
        // Calculate time spent
        let timeSpentSeconds = 0;
        if (session.started_at && session.completed_at) {
            timeSpentSeconds = Math.floor((new Date(session.completed_at) - new Date(session.started_at)) / 1000);
        }


        // Return detailed result
        res.json({
            success: true,
            message: 'Test result retrieved successfully',
            data: {
                sessionId: session.id,
                testId: session.test_id,
                testName: session.test?.title || 'Quiz Test',
                testUuid: session.test?.uuid,
                categoryName: 'General', // Default value
                completedAt: session.completed_at,
                totalQuestions: parseInt(session.total_questions) || 0,
                attempted: parseInt(session.attempted_questions) || 0,
                correct: parseInt(session.total_correct) || 0,
                wrong: parseInt(session.total_wrong) || 0,
                notAttempted: parseInt(session.total_unanswered) || 0,
                markedForReview: parseInt(session.total_marked_for_review) || 0,
                totalMarks: parseInt(session.total_questions) || 0, // Assuming 1 mark per question
                obtainedMarks: parseFloat(session.obtained_marks) || 0,
                negativeMarks: parseFloat(session.negative_marks),
                negativeMarksPerWrong: parseFloat(session.negative_marks_per_wrong),
                finalScore: parseFloat(session.final_score) || 0,
                percentage: parseInt(session.percentage), // ✅ Now using correct accuracy value
                accuracy: parseInt(session.accuracy), // ✅ Accuracy = (correct/attempted) × 100
                timeSpent: parseInt(timeSpentSeconds)
            }
        });

    } catch (error) {
        console.error('Test result detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve test result',
            error: error.message
        });
    }
});

/**
 * Get test solutions (questions with answers)
 * GET /api/test-history/:sessionId/solutions
 * Requires authentication - user ID extracted from JWT token
 */
router.get('/:sessionId/solutions', requireAuth, async (req, res) => {
    const language = req.query.language || 'both';

    // Helper function to choose English/Gujarati text
    const getText = (eng, guj) => {
        if (language === "gujarati") return guj || eng;
        return eng || guj;
        // return { english: eng, gujarati: guj };  // For "both"
    };

    try {
        const userId = req.user.uuid;
        const { sessionId } = req.params;

        // console.log(`🔍 Fetching solutions for session: ${sessionId}`);

        // Fetch session - must belong to authenticated user
        const session = await TestSession.findOne({
            where: {
                id: sessionId,
                user_id: userId
            },
            include: [{
                model: Test,
                as: 'test',
                attributes: ['id', 'title']
            }]
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Test session not found or access denied'
            });
        }

        // Fetch user answers for this session
        const userAnswers = await UserAnswer.findAll({
            where: {
                test_session_id: sessionId
            },
            include: [{
                model: Question,
                as: 'question',
                attributes: [
                    'id', 'question_text', 'question_text_gujarati',
                    'option_a', 'option_a_gujarati',
                    'option_b', 'option_b_gujarati',
                    'option_c', 'option_c_gujarati',
                    'option_d', 'option_d_gujarati',
                    'correct_answer', 'explanation', 'explanation_gujarati',
                    'marks'
                ],
                required: false, // LEFT JOIN instead of INNER JOIN
                separate: false  // Don't run separate query
            }],
            attributes: [
                'id', 'test_session_id', 'question_id',
                'selected_option', 'is_correct', 'is_flagged',
                'is_visited', 'time_spent', 'created_at'
            ],
            order: [['created_at', 'ASC']],
            raw: false  // Don't flatten results
        });

        // Format solutions
        const solutions = userAnswers.map(userAnswer => {
            const question = userAnswer.question;
            if (!question) return null;

            return {
                questionId: question.id,

                // Language-based question text
                questionText: getText(
                    question.question_text,
                    question.question_text_gujarati
                ),

                questionTextGujarati: question.question_text_gujarati,
                questionTextEnglish: question.question_text_gujarati,

                // Language-based options
                options: {
                    A: getText(question.option_a, question.option_a_gujarati),
                    B: getText(question.option_b, question.option_b_gujarati),
                    C: getText(question.option_c, question.option_c_gujarati),
                    D: getText(question.option_d, question.option_d_gujarati),
                },
                optionsEnglish: {
                    A: question.option_a,
                    B: question.option_b,
                    C: question.option_c,
                    D: question.option_d,
                },
                optionsGujarati: {
                    A: question.option_a_gujarati,
                    B: question.option_b_gujarati,
                    C: question.option_c_gujarati,
                    D: question.option_d_gujarati,
                },

                correctAnswer: question.correct_answer,
                userAnswer: userAnswer.selected_option, // Can be NULL for not attempted
                isCorrect: userAnswer.is_correct,
                isMarked: userAnswer.is_flagged || false, // ✅ Include marked for review status
                explanation: getText(
                    question.explanation,
                    question.explanation_gujarati
                ),
                explanationGujarati: question.explanation_gujarati,
                explanationEnglish: question.explanation,
                marks: parseFloat(question.marks || 1),
                negativeMarks: 0, // Default value
                timeSpent: userAnswer.time_spent || 0
            };
        })?.filter(q => q !== null)?.sort((a, b) => a.questionId - b.questionId); // Sort by question ID

        // Send response
        res.json({
            success: true,
            message: 'Test solutions retrieved successfully',
            data: {
                testName: session.test?.title || session.test_name || 'Quiz Test',
                categoryName: session.category_name || 'Test Category',
                totalQuestions: solutions.length,
                solutions
            }
        });

    } catch (error) {
        console.error('Test solutions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve test solutions',
            error: error.message
        });
    }
});


module.exports = router;
