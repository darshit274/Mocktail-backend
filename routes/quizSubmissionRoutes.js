const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { LeaderboardEntry, TestSeries, User, Test, TestSession, SubCategory, Category, Question, UserAnswer, sequelize } = require('../models');

/**
 * Simple quiz submission endpoint for frontend
 */
router.post('/submit', async (req, res) => {
    try {
        const {
            userId,
            testSeriesId, // This is actually the UUID from the frontend URL
            categoryUuid, // ← ADDED: Actual test/category UUID for history
            answers = [],
            totalTimeSpent = 120,
            markedForReviewCount = 0,
            totalQuestions: frontendTotalQuestions // Get actual total questions from frontend
        } = req.body;

        // console.log('Quiz submission received:', {
//             userId,
//             testSeriesId,
//             categoryUuid, // ← ADDED for debugging
//             answersCount: answers.length,
//             totalTimeSpent,
//             markedForReviewCount,
//             frontendTotalQuestions
//         });

        // Calculate score from answers
        // IMPORTANT: totalQuestions should be the ACTUAL total, not just answered questions
        const totalQuestions = frontendTotalQuestions || answers.length;
        const answeredQuestions = answers.filter(answer => answer.selectedOption).length;
        const correctAnswers = answers.filter(answer => answer.isCorrect).length;
        // wrongAnswers = answered questions that are INCORRECT (not including unanswered)
        const wrongAnswers = answeredQuestions - correctAnswers;
        const unansweredQuestions = totalQuestions - answeredQuestions;

        // console.log('🧮 QUIZ SCORE CALCULATION:', {
//             totalQuestions,
//             answeredQuestions,
//             correctAnswers,
//             wrongAnswers,
//             unansweredQuestions
//         });

        // Find or create user
        let user = await User.findOne({ where: { uuid: userId } });
        if (!user) {
            // Create a temporary user for this submission
            const uniqueId = Date.now() + Math.random().toString(36).substr(2, 9);
            user = await User.create({
                uuid: userId,
                username: `QuizUser_${uniqueId}`,
                email: `quiz-${uniqueId}@test.com`,
                password: 'temp-password',
                isEmailVerified: true,
                role: 'student'
            });
            // console.log(`Created user for quiz submission: ${user.uuid}`);
        }

        // Handle both mobile app and web app flows:
        // 1. Mobile app: sends TestSeries UUID as testSeriesId + Category UUID as categoryUuid
        // 2. Web app: sends Category UUID as testSeriesId (no categoryUuid)

        let category = null;
        let testSeries = null;

        // Try to find category using categoryUuid first (mobile app flow)
        if (categoryUuid) {
            // console.log('🔍 Mobile app flow: Finding category by categoryUuid:', categoryUuid);
            category = await Category.findOne({
                where: { uuid: categoryUuid },
                include: [{
                    model: TestSeries,
                    as: 'testSeries'
                }]
            });

            if (category) {
                testSeries = category.testSeries;
                // console.log('✅ Found category via categoryUuid:', {
//                     categoryId: category.id,
//                     categoryName: category.name,
//                     categoryUuid: category.uuid,
//                     testSeriesName: testSeries?.name
//                 });
            }
        }

        // If not found by categoryUuid, try testSeriesId as Category UUID (web app flow)
        if (!category) {
            // console.log('🔍 Web app flow: Finding category by testSeriesId as Category UUID:', testSeriesId);
            category = await Category.findOne({
                where: { uuid: testSeriesId },
                include: [{
                    model: TestSeries,
                    as: 'testSeries'
                }]
            });

            if (category) {
                testSeries = category.testSeries;
                // console.log('✅ Found category via testSeriesId:', {
//                     categoryId: category.id,
//                     categoryName: category.name,
//                     categoryUuid: category.uuid,
//                     testSeriesName: testSeries?.name
//                 });
            }
        }

        // If still not found, try testSeriesId as actual TestSeries UUID (mobile app with correct flow)
        if (!testSeries) {
            // console.log('🔍 Alternative flow: Finding TestSeries by testSeriesId as TestSeries UUID:', testSeriesId);
            testSeries = await TestSeries.findOne({
                where: { uuid: testSeriesId }
            });

            if (testSeries && categoryUuid) {
                // We have TestSeries but need the Category
                category = await Category.findOne({
                    where: { uuid: categoryUuid },
                    include: [{
                        model: TestSeries,
                        as: 'testSeries'
                    }]
                });

                // console.log('✅ Found TestSeries and Category separately:', {
//                     testSeriesName: testSeries.name,
//                     categoryName: category?.name
//                 });
            }
        }

        // Final validation
        if (!category) {
            console.error(`❌ Category not found. testSeriesId: ${testSeriesId}, categoryUuid: ${categoryUuid}`);
            return res.status(404).json({
                success: false,
                message: 'Category not found',
                error: `No category found with testSeriesId: ${testSeriesId} or categoryUuid: ${categoryUuid}`
            });
        }

        if (!testSeries) {
            console.error(`❌ TestSeries not found for category: ${category.name}`);
            return res.status(404).json({
                success: false,
                message: 'Test series not found for this category'
            });
        }

        // console.log('✅ Final resolved data:', {
//             categoryId: category.id,
//             categoryName: category.name,
//             categoryUuid: category.uuid,
//             testSeriesId: testSeries.id,
//             testSeriesName: testSeries.name,
//             testSeriesUuid: testSeries.uuid
//         });

        // console.log('🔍 TEST SERIES DATABASE VALUES:', {
//             uuid: testSeries.uuid,
//             name: testSeries.name,
//             has_negative_marking: testSeries.has_negative_marking,
//             negative_marks: testSeries.negative_marks,
//             negativeMarksType: typeof testSeries.negative_marks
//         });

        // Calculate score with actual marks per question
        let obtainedMarks = 0;
        let totalMarks = 0;

        // Calculate obtained marks and total marks from question data
        for (const answer of answers) {
            if (answer.questionId) {
                const question = await Question.findByPk(answer.questionId, {
                    attributes: ['id', 'marks']
                });

                if (question) {
                    const questionMarks = question.marks || 1; // Default to 1 if not set
                    totalMarks += questionMarks;

                    if (answer.isCorrect) {
                        obtainedMarks += questionMarks;
                    }
                }
            }
        }

        // Fallback if no questions found (shouldn't happen)
        if (totalMarks === 0) {
            obtainedMarks = correctAnswers; // 1 mark per correct answer as fallback
            totalMarks = totalQuestions; // 1 mark per question as fallback
        }

        let negativeMarks = 0;
        let finalScore = obtainedMarks;
        // Accuracy/Percentage = (correct answers / attempted questions) × 100
        let percentage = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;

        let negative_marks_per_wrong = 0;
        // NEW: Apply category-level negative marking logic
        if (wrongAnswers > 0) {
            // Group wrong answers by category to apply different negative marking rules
            const wrongAnswersByCategory = {};

            for (const answer of answers) {
                if (!answer.isCorrect && answer.questionId && answer.selectedOption) {
                    // Get the question and its category
                    const question = await Question.findByPk(answer.questionId, {
                        include: [{
                            model: Category,
                            as: 'category',
                            attributes: ['id', 'negative_marking_enabled', 'negative_marks_per_wrong']
                        }]
                    });

                    if (question && question.category) {
                        const categoryId = question.category.id;
                        if (!wrongAnswersByCategory[categoryId]) {
                            wrongAnswersByCategory[categoryId] = {
                                count: 0,
                                negative_marking_enabled: question.category.negative_marking_enabled,
                                negative_marks_per_wrong: question.category.negative_marks_per_wrong || 0.25
                            };
                        }
                        wrongAnswersByCategory[categoryId].count++;
                        negative_marks_per_wrong = question.category.negative_marks_per_wrong;
                    }
                }
            }

            // Calculate negative marks per category
            let totalNegativeMarks = 0;
            const categoryNegativeMarks = {};

            for (const [categoryId, categoryData] of Object.entries(wrongAnswersByCategory)) {
                if (categoryData.negative_marking_enabled) {
                    const categoryNegativeMarksValue = categoryData.count * categoryData.negative_marks_per_wrong;
                    categoryNegativeMarks[categoryId] = categoryNegativeMarksValue;
                    totalNegativeMarks += categoryNegativeMarksValue;
                }
            }

            negativeMarks = totalNegativeMarks;
            finalScore = obtainedMarks - negativeMarks;
            // Percentage stays the same - it's based on correct/attempted, not final score
            // percentage is already calculated above as (correctAnswers / answeredQuestions) × 100

            // console.log('✅ CATEGORY-LEVEL NEGATIVE MARKING APPLIED:', {
//                 obtainedMarks,
//                 wrongAnswersByCategory,
//                 categoryNegativeMarks,
//                 totalNegativeMarks: negativeMarks,
//                 finalScore,
//                 percentage: percentage + '%'
//             });
        } else {
            // console.log('❌ NO WRONG ANSWERS - NO NEGATIVE MARKING NEEDED:', {
//                 obtainedMarks,
//                 finalScore,
//                 percentage: percentage + '%'
//             });
        }

        const score = finalScore;

        // Calculate attempted marks for accuracy calculation
        let attemptedMarks = 0;
        for (const answer of answers) {
            if (answer.questionId) {
                const question = await Question.findByPk(answer.questionId, {
                    attributes: ['id', 'marks']
                });
                if (question) {
                    attemptedMarks += question.marks || 1;
                }
            }
        }

        // Calculate accuracy: (correct answers / attempted questions) × 100
        // This is the same as percentage - both represent accuracy
        const accuracy = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;

        // Use the existing category (already fetched above with testSeries)
        // No need to create fake categories anymore!

        // Find or create a subcategory for this category (for backward compatibility with Test model)
        let subCategory = await SubCategory.findOne({
            where: { category_id: category.id }
        });

        if (!subCategory) {
            // Create a default subcategory if none exists (one-time per category)
            subCategory = await SubCategory.create({
                category_id: category.id,
                name: `${category.name} - Questions`,
                description: `Questions for ${category.name}`,
                is_active: true
            });
            // console.log(`✅ Created default subcategory for category: ${category.name}`);
        }

        // Create a test session record (required for LeaderboardEntry and history)
        // Use the category name for better identification
        const test = await Test.create({
            uuid: uuidv4(), // Use proper UUID format
            title: category.name, // Use actual category name instead of generic "Quiz Test"
            subtitle: category.description || 'Quiz submission',
            instructions: category.instructions || 'Quiz taken through frontend',
            duration_minutes: category.test_duration_minutes || Math.ceil(totalTimeSpent / 60),
            total_questions: totalQuestions,
            passing_marks: Math.ceil(totalQuestions * 0.6), // 60% passing
            negative_marking_enabled: category.negative_marking_enabled || negativeMarks > 0,
            negative_marks_per_wrong: category.negative_marks_per_wrong || 0,
            is_active: true,
            sub_category_id: subCategory.id
        });

        // console.log(`✅ Created test session record: ${test.title}`);
        // Create a test session with test history fields
        const testSession = await TestSession.create({
            id: uuidv4(),
            user_id: userId,
            test_id: test.id,
            status: 'completed',
            started_at: new Date(Date.now() - totalTimeSpent * 1000),
            completed_at: new Date(),
            is_completed: true,
            is_submitted: true,
            calculated_score: score,
            total_correct: correctAnswers,
            total_wrong: wrongAnswers,
            total_unanswered: unansweredQuestions,
            total_marked_for_review: markedForReviewCount,
            total_questions: totalQuestions,
            time_spent_seconds: totalTimeSpent,
            final_score: finalScore?? score,
            percentage: percentage,
            // Test history fields
            test_name: test.title,
            category_name: category.name,
            total_marks: totalMarks,
            obtained_marks: obtainedMarks,
            negative_marks: negativeMarks,
            attempted_questions: answeredQuestions,
            accuracy: accuracy,
            negative_marks_per_wrong: negative_marks_per_wrong,
            // IMPORTANT: Store the actual DynamicCategory UUID for test history grouping
            session_data: {
                category_uuid: categoryUuid || testSeriesId, // Use categoryUuid if provided, fallback to testSeriesId
                submission_source: 'dynamic_category_quiz'
            }
        });

        // console.log(`✅ Created TestSession: ${testSession.id}`);

        // Save individual answers to UserAnswer table
        // This enables session-based solution retrieval and tracking user progress
        try {
            const answerPromises = answers.map(async (answer) => {
                return await UserAnswer.create({
                    test_session_id: testSession.id,
                    question_id: answer.questionId,
                    selected_option: answer.selectedOption, // Can be null for not attempted
                    is_correct: answer.isCorrect || false,
                    is_flagged: answer.markedForReview || false, // Save marked for review status
                    is_visited: answer.selectedOption !== null, // Track if question was visited
                    time_spent: answer.timeSpent || 0
                });
            });

            await Promise.all(answerPromises);
            // console.log(`✅ Saved ${answers.length} UserAnswer records for session ${testSession.id}`);
        } catch (userAnswerError) {
            console.error('Error saving UserAnswer records:', userAnswerError);
            // Don't fail the submission if UserAnswer save fails
            // The TestSession and leaderboard entry are already created
        }

        // Create leaderboard entry directly
        const leaderboardEntry = await LeaderboardEntry.create({
            user_id: userId,
            test_id: test.id, // Use the created test ID
            test_session_id: testSession.id,
            test_series_id: null, // Set to null to avoid foreign key issues for now
            category_id: null,
            score: score,
            final_score: finalScore,
            percentage: percentage,
            total_questions: totalQuestions,
            correct_answers: correctAnswers,
            wrong_answers: wrongAnswers,
            unanswered: unansweredQuestions,
            time_taken_seconds: totalTimeSpent,
            rank: 1, // Will be recalculated
            percentile: 100, // Will be recalculated
            completion_date: new Date(),
            is_valid: true
        });

        // console.log(`Created leaderboard entry: ${leaderboardEntry.id}`);

        res.json({
            success: true,
            message: 'Quiz submitted successfully!',
            data: {
                sessionId: testSession.id,  // ✅ ADD: TestSession UUID for solutions API
                leaderboardEntryId: leaderboardEntry.id,
                score: score,
                totalQuestions: totalQuestions,
                answeredQuestions: answeredQuestions,
                correctAnswers: correctAnswers,
                wrongAnswers: wrongAnswers,
                unansweredQuestions: unansweredQuestions,
                percentage: percentage,
                // Alternative field names in case frontend uses different keys
                finalPercentage: percentage,
                calculatedPercentage: percentage,
                actualPercentage: percentage,
                // Mark calculation info (updated for variable marks per question)
                totalMarks: totalMarks,
                obtainedMarks: obtainedMarks,
                negativeMarkingEnabled: negativeMarks > 0, // True if any category had negative marking
                negativeMarksDeducted: negativeMarks,
                negativeMarkValue: 0, // Set to 0 since it now varies by category
                finalScore: finalScore,
                completionTime: new Date().toISOString(),
                timestamp: Date.now(), // Cache buster
                // Override any frontend calculation
                displayPercentage: percentage,
                resultPercentage: percentage,
                scorePercentage: percentage,
                debug: {
                    totalMarks,
                    obtainedMarks,
                    negativeMarks,
                    finalScore,
                    accuracyCalculation: `Accuracy = (${correctAnswers}/${answeredQuestions}) × 100 = ${percentage}%`,
                    scoreCalculation: `Score = (1 × ${correctAnswers}) - (0.25 × ${wrongAnswers}) = ${correctAnswers} - ${negativeMarks.toFixed(2)} = ${finalScore}`,
                    wrongAnswersCalculation: `Wrong = Attempted - Correct = ${answeredQuestions} - ${correctAnswers} = ${wrongAnswers}`,
                    marksCalculation: `Total Marks: ${totalMarks}, Obtained: ${obtainedMarks}, After Negative: ${finalScore}`,
                    warning: "Frontend should use 'percentage', 'wrongAnswers', and 'finalScore' fields from backend"
                }
            }
        });

    } catch (error) {
        console.error('Quiz submission error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to submit quiz',
            error: error.message,
            details: error.errors ? error.errors.map(e => e.message) : []
        });
    }
});

/**
 * Clear contaminated data for a test series
 */
router.delete('/clear-series/:testSeriesId', async (req, res) => {
    try {
        const { testSeriesId } = req.params;

        // console.log(`Clearing all data for test series: ${testSeriesId}`);

        // Find test series
        const testSeries = await TestSeries.findOne({ where: { uuid: testSeriesId } });
        if (!testSeries) {
            return res.json({ success: false, message: 'Test series not found' });
        }

        // Find all related tests and categories
        const categories = await Category.findAll({ where: { test_series_id: testSeries.id } });
        const categoryIds = categories.map(c => c.id);

        const subCategories = await SubCategory.findAll({ where: { category_id: categoryIds } });
        const subCategoryIds = subCategories.map(sc => sc.id);

        const tests = await Test.findAll({ where: { sub_category_id: subCategoryIds } });
        const testIds = tests.map(t => t.id);

        // Delete all related data
        const deletedLeaderboard = await LeaderboardEntry.destroy({ where: { test_id: testIds } });
        const deletedSessions = await TestSession.destroy({ where: { test_id: testIds } });
        const deletedTests = await Test.destroy({ where: { id: testIds } });
        const deletedSubCategories = await SubCategory.destroy({ where: { id: subCategoryIds } });
        const deletedCategories = await Category.destroy({ where: { id: categoryIds } });
        const deletedTestSeries = await TestSeries.destroy({ where: { id: testSeries.id } });

        // console.log(`Deleted: ${deletedLeaderboard} leaderboard entries, ${deletedSessions} sessions, ${deletedTests} tests`);

        res.json({
            success: true,
            message: 'Test series data cleared successfully',
            deleted: {
                leaderboardEntries: deletedLeaderboard,
                testSessions: deletedSessions,
                tests: deletedTests,
                subCategories: deletedSubCategories,
                categories: deletedCategories,
                testSeries: deletedTestSeries
            }
        });

    } catch (error) {
        console.error('Error clearing test series:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get latest quiz result for a user and test series
 */
router.get('/latest-result/:userId/:testSeriesId', async (req, res) => {
    try {
        const { userId, testSeriesId } = req.params;

        // console.log(`🔍 Getting latest result for user ${userId} in test series ${testSeriesId}`);

        // Find the latest leaderboard entry for this user and test series
        const latestEntry = await LeaderboardEntry.findOne({
            where: {
                user_id: userId,
                test_series_id: testSeriesId
            },
            order: [['completion_date', 'DESC']],
            include: [{
                model: TestSeries,
                as: 'testSeries',
                attributes: ['name', 'has_negative_marking', 'negative_marks']
            }]
        });

        if (!latestEntry) {
            return res.status(404).json({
                success: false,
                message: 'No quiz results found for this user and test series'
            });
        }

        // console.log(`✅ Found latest result: ${latestEntry.percentage}% (entry ID: ${latestEntry.id})`);

        res.json({
            success: true,
            message: 'Latest quiz result retrieved successfully',
            data: {
                leaderboardEntryId: latestEntry.id,
                score: parseFloat(latestEntry.score),
                totalQuestions: latestEntry.total_questions,
                correctAnswers: latestEntry.correct_answers,
                wrongAnswers: latestEntry.wrong_answers,
                percentage: latestEntry.percentage,
                completionTime: latestEntry.completion_date,
                negativeMarkingEnabled: latestEntry.testSeries?.has_negative_marking || false,
                timestamp: Date.now()
            }
        });

    } catch (error) {
        console.error('Get latest result error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest quiz result',
            error: error.message
        });
    }
});

/**
 * Nuclear option - clear ALL old contaminated leaderboard data
 */
router.post('/nuclear-clean', async (req, res) => {
    try {
        // console.log('NUCLEAR CLEAN: Clearing all old leaderboard data...');

        // Delete all leaderboard entries that are NOT from today's submissions
        const today = new Date();
        today.setHours(11, 0, 0, 0); // 11 AM today

        const deletedEntries = await LeaderboardEntry.destroy({
            where: {
                completion_date: {
                    [require('sequelize').Op.lt]: today
                }
            }
        });

        // console.log(`NUCLEAR CLEAN: Deleted ${deletedEntries} old leaderboard entries`);

        res.json({
            success: true,
            message: `Nuclear clean completed - deleted ${deletedEntries} old entries`,
            deletedCount: deletedEntries
        });

    } catch (error) {
        console.error('Nuclear clean error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
