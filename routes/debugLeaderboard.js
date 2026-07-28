const express = require('express');
const router = express.Router();
const { TestSeries, Test, NewTest, Category, SubCategory, LeaderboardEntry, User } = require('../models');

/**
 * Debug endpoint to see what's happening with leaderboard queries
 */
router.get('/test-series/:testSeriesId', async (req, res) => {
    try {
        const { testSeriesId } = req.params;

        // console.log('=== LEADERBOARD DEBUG ===');
        // console.log('Test Series UUID:', testSeriesId);

        // 1. Check if test series exists
        const testSeries = await TestSeries.findOne({
            where: { uuid: testSeriesId }
        });

        // console.log('1. Test Series found:', testSeries ? `ID: ${testSeries.id}, Name: ${testSeries.name}` : 'NOT FOUND');

        if (!testSeries) {
            return res.json({ error: 'Test series not found', testSeriesId });
        }

        // 2. Check for NewTest entries
        const newTests = await NewTest.findAll({
            where: { test_series_id: testSeries.id },
            attributes: ['id', 'title']
        });

        // console.log('2. NewTests found:', newTests.length, newTests.map(t => `ID: ${t.id}, Title: ${t.title}`));

        // 3. Check for Categories linked to this test series
        const categories = await Category.findAll({
            where: { test_series_id: testSeries.id },
            attributes: ['id', 'name']
        });

        // console.log('3. Categories found:', categories.length, categories.map(c => `ID: ${c.id}, Name: ${c.name}`));

        // 4. Check for Tests linked through categories
        const oldTests = await Test.findAll({
            include: [{
                model: SubCategory,
                as: 'subCategory',
                include: [{
                    model: Category,
                    as: 'category',
                    where: { test_series_id: testSeries.id }
                }]
            }],
            attributes: ['id', 'title', 'sub_category_id']
        });

        // console.log('4. Old Tests found:', oldTests.length, oldTests.map(t => `ID: ${t.id}, Title: ${t.title}, SubCat: ${t.sub_category_id}`));

        // 5. Get all test IDs
        const newTestIds = newTests.map(t => t.id);
        const oldTestIds = oldTests.map(t => t.id);
        const allTestIds = [...newTestIds, ...oldTestIds];

        // console.log('5. All Test IDs:', allTestIds);

        // 6. Check for leaderboard entries with these test IDs
        const leaderboardEntries = await LeaderboardEntry.findAll({
            where: {
                test_id: allTestIds.length > 0 ? { [require('sequelize').Op.in]: allTestIds } : null
            },
            include: [{
                model: User,
                as: 'user',
                attributes: ['uuid', 'username'],
                required: false
            }],
            attributes: ['id', 'user_id', 'test_id', 'score', 'percentage', 'completion_date'],
            order: [['id', 'DESC']],
            limit: 10
        });

        // console.log('6. Leaderboard Entries found:', leaderboardEntries.length);
        leaderboardEntries.forEach(entry => {
            // console.log(`   Entry ID: ${entry.id}, User: ${entry.user_id} (${entry.user?.username}), Test: ${entry.test_id}, Score: ${entry.score}`);
        });

        // 7. Also check ALL leaderboard entries (ignoring test_id filter)
        const allLeaderboardEntries = await LeaderboardEntry.findAll({
            include: [{
                model: User,
                as: 'user',
                attributes: ['uuid', 'username'],
                required: false
            }],
            attributes: ['id', 'user_id', 'test_id', 'score', 'percentage', 'completion_date'],
            order: [['id', 'DESC']],
            limit: 5
        });

        // console.log('7. ALL Recent Leaderboard Entries:', allLeaderboardEntries.length);
        allLeaderboardEntries.forEach(entry => {
            // console.log(`   Entry ID: ${entry.id}, User: ${entry.user_id} (${entry.user?.username}), Test: ${entry.test_id}, Score: ${entry.score}`);
        });

        // console.log('=== END DEBUG ===');

        res.json({
            testSeriesId,
            testSeries: testSeries ? { id: testSeries.id, name: testSeries.name } : null,
            newTests: newTests.map(t => ({ id: t.id, title: t.title })),
            categories: categories.map(c => ({ id: c.id, name: c.name })),
            oldTests: oldTests.map(t => ({ id: t.id, title: t.title, subCategoryId: t.sub_category_id })),
            allTestIds,
            leaderboardEntries: leaderboardEntries.map(entry => ({
                id: entry.id,
                userId: entry.user_id,
                username: entry.user?.username,
                testId: entry.test_id,
                score: entry.score,
                percentage: entry.percentage
            })),
            allRecentEntries: allLeaderboardEntries.map(entry => ({
                id: entry.id,
                userId: entry.user_id,
                username: entry.user?.username,
                testId: entry.test_id,
                score: entry.score
            }))
        });

    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

module.exports = router;