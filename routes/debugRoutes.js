const express = require('express');
const router = express.Router();
const { TestSession } = require('../models');

/**
 * Debug endpoint to check latest test session data
 * GET /api/debug/latest-session/:userId
 */
router.get('/latest-session/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // console.log(`🔍 DEBUG: Fetching latest session for user: ${userId}`);

        const latestSession = await TestSession.findOne({
            where: {
                user_id: userId,
                status: 'completed',
                is_completed: true
            },
            order: [['completed_at', 'DESC']],
            attributes: [
                'id', 'user_id', 'test_id', 'completed_at',
                'calculated_score', 'total_questions',
                'session_data', 'test_name', 'category_name'
            ]
        });

        if (!latestSession) {
            return res.json({
                success: false,
                message: 'No sessions found for this user'
            });
        }

        // console.log('📊 Latest session data:', {
//             id: latestSession.id,
//             session_data: latestSession.session_data,
//             session_data_type: typeof latestSession.session_data,
//             category_uuid: latestSession.session_data?.category_uuid
//         });

        res.json({
            success: true,
            data: {
                sessionId: latestSession.id,
                userId: latestSession.user_id,
                testId: latestSession.test_id,
                completedAt: latestSession.completed_at,
                score: latestSession.calculated_score,
                totalQuestions: latestSession.total_questions,
                session_data: latestSession.session_data,
                session_data_type: typeof latestSession.session_data,
                category_uuid_from_session_data: latestSession.session_data?.category_uuid,
                testName: latestSession.test_name,
                categoryName: latestSession.category_name
            }
        });

    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
