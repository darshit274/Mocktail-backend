const { Op, Sequelize } = require("sequelize");
const {
  LeaderboardEntry,
  User,
  TestSeries,
  Test,
  TestSession,
} = require("../models");

class LeaderboardController {
  // Get global leaderboard
  static async getLeaderboard(req, res) {
    try {
      const { limit = 50, test_series_id, category_id } = req.query;

      // console.log("Fetching dynamic leaderboard data...");

      // Try to get real leaderboard data from LeaderboardEntry table
      let leaderboardData = [];

      try {
        // Build where clause for filtering
        const where = { is_valid: true };

        if (test_series_id) {
          where.test_series_id = test_series_id;
        }

        if (category_id) {
          where.category_id = category_id;
        }

        // Get actual leaderboard entries
        const leaderboardEntries = await LeaderboardEntry.findAll({
          where,
          include: [
            {
              model: User,
              as: "user",
              attributes: [
                "uuid",
                "username",
                "email",
                "profileImage",
                "avatarUrl",
              ],
            },
            {
              model: TestSeries,
              as: "testSeries",
              attributes: ["name", "uuid"],
              required: false,
            },
          ],
          order: [
            ["score", "DESC"], // Highest score first
            ["completion_date", "ASC"], // Earlier completion time as tiebreaker
          ],
          limit: parseInt(limit),
        });

        // console.log(`Found ${leaderboardEntries.length} leaderboard entries`);

        if (leaderboardEntries.length > 0) {
          // Process real leaderboard data
          leaderboardData = leaderboardEntries.map((entry, index) => ({
            rank: index + 1, // Calculate rank based on position
            userId: entry.user_id,
            name: entry.user?.username || "Unknown User",
            totalScore: Math.round(parseFloat(entry.score || 0)),
            testsCompleted: 1, // This entry represents one completed test
            percentage: parseFloat(entry.percentage || 0),
            correctAnswers: entry.correct_answers || 0,
            totalQuestions: entry.total_questions || 0,
            timeTaken: entry.time_taken_seconds || 0,
            completionDate: entry.completion_date,
            avatar: entry.user?.avatarUrl || entry.user?.profileImage || null,
            testSeriesName: entry.testSeries?.name || "Unknown Test",
          }));

          // Calculate tests completed per user by counting entries
          const userTestCounts = await LeaderboardEntry.findAll({
            where: { is_valid: true },
            attributes: [
              "user_id",
              [Sequelize.fn("COUNT", Sequelize.col("id")), "test_count"],
            ],
            group: ["user_id"],
            raw: true,
          });

          const testCountMap = {};
          userTestCounts.forEach((item) => {
            testCountMap[item.user_id] = parseInt(item.test_count);
          });

          // Update testsCompleted with actual counts
          leaderboardData = leaderboardData.map((entry) => ({
            ...entry,
            testsCompleted: testCountMap[entry.userId] || 1,
          }));
        }
      } catch (dbError) {
        // console.log(
//           "Error fetching from LeaderboardEntry, trying TestSession...",
//           dbError.message
//         );

        // Fallback to TestSession data if LeaderboardEntry is empty
        const testSessions = await TestSession.findAll({
          where: {
            is_completed: true,
            is_submitted: true,
            calculated_score: { [Op.not]: null },
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: [
                "uuid",
                "username",
                "email",
                "profileImage",
                "avatarUrl",
              ],
              required: true,
            },
          ],
          order: [
            ["calculated_score", "DESC"],
            ["completed_at", "ASC"],
          ],
          limit: parseInt(limit),
        });

        // console.log(`Found ${testSessions.length} completed test sessions`);

        if (testSessions.length > 0) {
          leaderboardData = testSessions.map((session, index) => ({
            rank: index + 1,
            userId: session.user_id,
            name: session.user?.username || "Unknown User",
            totalScore: Math.round(parseFloat(session.calculated_score || 0)),
            testsCompleted: 1,
            correctAnswers: session.total_correct || 0,
            totalQuestions: session.total_questions || 0,
            wrongAnswers: session.total_wrong || 0,
            completionDate: session.completed_at,
            avatar:
              session.user?.avatarUrl || session.user?.profileImage || null,
          }));

          // Count total tests per user from TestSession
          const userSessionCounts = await TestSession.findAll({
            where: { is_completed: true, is_submitted: true },
            attributes: [
              "user_id",
              [Sequelize.fn("COUNT", Sequelize.col("id")), "session_count"],
            ],
            group: ["user_id"],
            raw: true,
          });

          const sessionCountMap = {};
          userSessionCounts.forEach((item) => {
            sessionCountMap[item.user_id] = parseInt(item.session_count);
          });

          leaderboardData = leaderboardData.map((entry) => ({
            ...entry,
            testsCompleted: sessionCountMap[entry.userId] || 1,
          }));
        }
      }

      // If no real data available, fall back to demo data
      if (leaderboardData.length === 0) {
        // console.log("No test data found, generating demo leaderboard");

        const demoUsers = [
          { name: "Top Performer", score: 2850, tests: 15 },
          { name: "Quiz Master", score: 2720, tests: 12 },
          { name: "Study Champion", score: 2650, tests: 18 },
          { name: "Knowledge Seeker", score: 2580, tests: 10 },
          { name: "Test Taker Pro", score: 2510, tests: 14 },
          { name: "Learning Hero", score: 2445, tests: 11 },
          { name: "Score Chaser", score: 2380, tests: 16 },
          { name: "Quiz Ninja", score: 2315, tests: 9 },
          { name: "Study Warrior", score: 2250, tests: 13 },
          { name: "Knowledge King", score: 2185, tests: 8 },
        ];

        leaderboardData = demoUsers
          .slice(0, parseInt(limit))
          .map((user, index) => ({
            rank: index + 1,
            userId: Math.floor(Math.random() * 100000) + 1000,
            name: user.name,
            totalScore: user.score,
            testsCompleted: user.tests,
            avatar: null,
            isDemo: true,
          }));
      }

      res.json({
        success: true,
        message: "Leaderboard retrieved successfully",
        data: leaderboardData,
        metadata: {
          total: leaderboardData.length,
          limit: parseInt(limit),
          hasMore: false,
          dataSource:
            leaderboardData.length > 0 && leaderboardData[0].isDemo
              ? "demo"
              : "real",
          userUuid: req.user?.uuid,
        },
      });
    } catch (error) {
      console.error("Leaderboard error:", error);
      console.error("Leaderboard error stack:", error.stack);
      console.error("Leaderboard error message:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve leaderboard data",
        error: error.message,
      });
    }
  }

  // Get user's rank and position
  static async getUserRank(req, res) {
    try {
      const userId = req.user?.uuid; // Use UUID for user identification

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // console.log(`Fetching rank for user: ${userId}`);

      let userRank = null;

      try {
        // Try to get user's rank from LeaderboardEntry
        const userEntries = await LeaderboardEntry.findAll({
          where: {
            user_id: userId,
            is_valid: true,
          },
          order: [["score", "DESC"]],
          limit: 1,
        });

        if (userEntries.length > 0) {
          const bestEntry = userEntries[0];

          // Count unique users with higher scores to determine rank
          const betterUsersCount = await LeaderboardEntry.count({
            where: {
              is_valid: true,
              score: { [Op.gt]: bestEntry.score },
            },
            distinct: true,
            col: 'user_id',
          });

          const totalUsers = await LeaderboardEntry.count({
            where: { is_valid: true },
            distinct: true,
            col: 'user_id',
          });

          const testsCompleted = await LeaderboardEntry.count({
            where: { user_id: userId, is_valid: true },
          });

          const totalScore = await LeaderboardEntry.sum("score", {
            where: { user_id: userId, is_valid: true },
          });

          userRank = {
            rank: betterUsersCount + 1,
            totalScore: Math.round(parseFloat(totalScore) || 0),
            testsCompleted,
            bestScore: Math.round(parseFloat(bestEntry.score) || 0),
            bestPercentage: parseFloat(bestEntry.percentage) || 0,
            percentile: Math.round((1 - betterUsersCount / totalUsers) * 100),
            totalUsers,
            dataSource: "leaderboard",
          };
        }
      } catch (dbError) {
        // console.log(
//           "Error fetching from LeaderboardEntry, trying TestSession...",
//           dbError.message
//         );

        // Fallback to TestSession data
        const userSessions = await TestSession.findAll({
          where: {
            user_id: userId,
            is_completed: true,
            is_submitted: true,
            calculated_score: { [Op.not]: null },
          },
          order: [["calculated_score", "DESC"]],
          limit: 1,
        });

        if (userSessions.length > 0) {
          const bestSession = userSessions[0];

          // Count unique users with higher scores
          const betterUsersCount = await TestSession.count({
            where: {
              is_completed: true,
              is_submitted: true,
              calculated_score: { [Op.gt]: bestSession.calculated_score },
            },
            distinct: true,
            col: 'user_id',
          });

          const totalUsers = await TestSession.count({
            where: {
              is_completed: true,
              is_submitted: true,
              calculated_score: { [Op.not]: null },
            },
            distinct: true,
            col: 'user_id',
          });

          const testsCompleted = await TestSession.count({
            where: {
              user_id: userId,
              is_completed: true,
              is_submitted: true,
            },
          });

          const totalScore = await TestSession.sum("calculated_score", {
            where: {
              user_id: userId,
              is_completed: true,
              is_submitted: true,
            },
          });

          userRank = {
            rank: betterUsersCount + 1,
            totalScore: Math.round(parseFloat(totalScore) || 0),
            testsCompleted,
            bestScore: Math.round(
              parseFloat(bestSession.calculated_score) || 0
            ),
            percentile: Math.round((1 - betterUsersCount / totalUsers) * 100),
            totalUsers,
            dataSource: "sessions",
          };
        }
      }

      // If no real data, generate demo rank
      if (!userRank) {
        // console.log("No test data found for user, generating demo rank");
        userRank = {
          rank: Math.floor(Math.random() * 500) + 10,
          totalScore: Math.floor(Math.random() * 2000) + 1500,
          testsCompleted: Math.floor(Math.random() * 15) + 5,
          percentile: Math.floor(Math.random() * 80) + 15,
          totalUsers: 1547,
          dataSource: "demo",
        };
      }

      // console.log(userRank);

      res.json({
        success: true,
        message: "User rank retrieved successfully",
        data: userRank,
      });
    } catch (error) {
      console.error("User rank error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user rank",
      });
    }
  }

  // Get leaderboard for specific test series
  static async getTestSeriesLeaderboard(req, res) {
    try {
      const { testSeriesId } = req.params;
      const { limit = 20 } = req.query;

      // console.log(`🔍 Fetching leaderboard for UUID: ${testSeriesId}`);

      let leaderboardData = [];
      let strictTestIds = [];

      try {
        // ✅ SMART UUID DETECTION: Check if UUID is test series OR category
        let testSeries = await TestSeries.findOne({
          where: { uuid: testSeriesId },
          attributes: ["id", "name", "uuid"],
        });

        if (!testSeries) {
          const testSession = await TestSession.findAll({
            where: {
              id: testSeriesId,
            }
          })

          if (testSession.length > 0) {
            const test = await Test.findAll({
              where: {
                id: testSession?.[0]?.test_id
              },
              attributes: ["sub_category_id"],
            })
            const subCategoryId = test?.[0]?.sub_category_id;
            if (subCategoryId) {
              const AlltestIds = await Test.findAll({
                where: {
                  sub_category_id: subCategoryId
                },
                attributes: ["id"],
              })
              strictTestIds = AlltestIds.map((test) => test.id);
            }

          }
        }



        if (strictTestIds.length === 0) {
          // If not found as test series, check if it's a category UUID
          if (!testSeries) {
            // console.log(`❌ Not found as test series UUID, checking if it's a category UUID...`);

            const { Category } = require("../models");
            const category = await Category.findOne({
              where: { uuid: testSeriesId },
              include: [{
                model: TestSeries,
                as: 'testSeries',
                attributes: ['id', 'name', 'uuid']
              }]
            });

            if (category && category.testSeries) {
              testSeries = category.testSeries;
              // console.log(`✅ Found as category UUID! Using parent test series: ${testSeries.name} (${testSeries.uuid})`);
            } else {
              // console.log(`❌ UUID not found as test series OR category`);
              return res.json({
                success: true,
                message: "No participants found for this test series yet",
                data: [],
                testSeriesId,
                metadata: {
                  total: 0,
                  limit: parseInt(limit),
                  dataSource: "empty",
                  message: "Be the first to take a test in this series!",
                },
              });
            }
          } else {
            // console.log(`✅ Found as test series UUID: ${testSeries.name}`);
          }

          // Find all tests that belong to this test series
          const { NewTest } = require("../models");
          const testsInSeries = await NewTest.findAll({
            where: { test_series_id: testSeries.id },
            attributes: ["id"],
          });

          const testIds = testsInSeries.map((test) => test.id);

          // Don't return early if NewTest is empty - we also check old tests below

          // Get all test IDs (both old and new system) that belong to this test series
          const { Test, SubCategory, Category } = require("../models");
          const oldTests = await Test.findAll({
            include: [
              {
                model: SubCategory,
                as: "subCategory",
                include: [
                  {
                    model: Category,
                    as: "category",
                    where: { test_series_id: testSeries.id },
                  },
                ],
              },
            ],
            attributes: ["id"],
          });

          const oldTestIds = oldTests.map((test) => test.id);
          const allTestIds = [...testIds, ...oldTestIds];

          // console.log(
          //   `Looking for leaderboard entries with test IDs: NewTest[${testIds.join(
          //     ","
          //   )}] + OldTest[${oldTestIds.join(",")}]`
          // );
          // console.log("All test IDs for query:", allTestIds);
          // console.log("Query will be: test_id IN", allTestIds);

          // Check if we have any test IDs to search for
          if (allTestIds.length === 0) {
            // console.log("No test IDs found - returning empty leaderboard");
            return res.json({
              success: true,
              message: "No participants found for this test series yet",
              data: [],
              testSeriesId,
              metadata: {
                total: 0,
                limit: parseInt(limit),
                dataSource: "empty",
                message: "Be the first to take a test in this series!",
              },
            });
          }

          // STRICT FILTERING: Only get entries for THIS specific test series UUID
          // Find tests that were created ONLY for this test series by checking category ownership

          // Only include tests from categories that EXCLUSIVELY belong to this test series
          for (const category of await Category.findAll({
            where: { test_series_id: testSeries.id },
          })) {
            const subCats = await SubCategory.findAll({
              where: { category_id: category.id },
            });
            for (const subCat of subCats) {
              const tests = await Test.findAll({
                where: { sub_category_id: subCat.id },
              });
              strictTestIds.push(...tests.map((t) => t.id));
            }
          }
        }
        // console.log(
        //   `STRICT filtering: Using ONLY test IDs: [${strictTestIds.join(
        //     ","
        //   )}] for test series ${testSeriesId}`
        // );

        if (strictTestIds.length === 0) {
          return res.json({
            success: true,
            message: "No participants found for this test series yet",
            data: [],
            testSeriesId,
            metadata: {
              total: 0,
              limit: parseInt(limit),
              dataSource: "empty",
              message: "Be the first to take a test in this series!",
            },
          });
        }

        // SIMPLIFIED: Get all leaderboard entries for this test series and process in JS
        const allEntries = await LeaderboardEntry.findAll({
          where: {
            test_id: { [Op.in]: strictTestIds }, // ONLY tests that belong EXCLUSIVELY to this series
            is_valid: true,
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["uuid", "username", "profileImage", "avatarUrl"],
              required: false, // Changed to false to include entries even if user lookup fails
            },
          ],
          order: [
            ["score", "DESC"],
            ["completion_date", "ASC"],
          ],
          raw: false,
        });

        // console.log(
//           `Found ${allEntries.length} entries for test series ${testSeriesId}`
//         );

        // ✅ FIXED: Group by user and get FIRST ATTEMPT (earliest completion_date) instead of best score
        const userFirstAttempts = {};
        allEntries.forEach((entry) => {
          const userId = entry.user_id;
          if (
            !userFirstAttempts[userId] ||
            new Date(entry.completion_date) < new Date(userFirstAttempts[userId].completion_date)
          ) {
            userFirstAttempts[userId] = {
              ...entry.toJSON(),
              user: entry.user ? entry.user.toJSON() : { username: 'Unknown User' },
            };
          }
        });

        // Convert to array and sort by FIRST ATTEMPT score (DESC), then by completion date (ASC)
        const detailedEntries = Object.values(userFirstAttempts)
          .sort((a, b) => {
            // Primary: Score descending (higher score ranks better)
            if (b.score !== a.score) return b.score - a.score;
            // Tiebreaker: Earlier completion wins
            return new Date(a.completion_date) - new Date(b.completion_date);
          })
          .slice(0, parseInt(limit));

        if (detailedEntries.length > 0) {
          // console.log(
//             `✅ Found ${detailedEntries.length} unique users for test series (ranked by FIRST ATTEMPT)`
//           );
          const totalUser = detailedEntries.length
          leaderboardData = detailedEntries.map((entry, index) => ({
            rank: index + 1,
            userId: entry.user_id,
            name: entry.user?.username ?? "Unknown User",
            totalScore: parseFloat(entry.score) ?? 0,
            finalScore: parseFloat(entry.final_score ?? 0),
            percentage: parseFloat(entry.percentage) ?? 0,
            correctAnswers: entry.correct_answers ?? 0,
            totalQuestions: entry.total_questions ?? 0,
            timeTaken: entry.time_taken_seconds ?? 0,
            completionDate: entry.completion_date, // This is the first attempt date
            avatar: entry.user.avatarUrl ?? entry.user.profileImage ?? null,
            testSeriesName: entry.testSeries?.name,
            percentile: (((totalUser - (index + 1) + 1) / totalUser) * 100).toFixed(2),
            isDemo: false,
          }));
        } else {
          // Fallback to TestSession data if LeaderboardEntry is empty
          // console.log(
//             "No LeaderboardEntry found, checking TestSession data..."
//           );

          // Find the test series by UUID to get its ID
          const testSeries = await TestSeries.findOne({
            where: { uuid: testSeriesId },
            attributes: ["id", "name", "uuid"],
          });

          if (testSeries) {
            // console.log(
//               `Found test series: ${testSeries.name} (ID: ${testSeries.id})`
//             );
            // console.log(
//               `Looking for test sessions for test series ID: ${testSeries.id}`
//             );

            // Get ALL test sessions for tests in this specific test series
            const testSessions = await TestSession.findAll({
              where: {
                is_completed: true,
                is_submitted: true,
                calculated_score: { [Op.not]: null },
              },
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["uuid", "username", "profileImage", "avatarUrl"],
                  required: true,
                },
                {
                  model: Test,
                  as: "test",
                  where: { test_series_id: testSeries.id },
                  attributes: ["id", "name", "test_series_id"],
                  required: true,
                },
              ],
              order: [
                ["completed_at", "ASC"], // ✅ FIXED: Order by completion time to get chronological attempts
              ],
            });

            // console.log(
//               `Found ${testSessions.length} completed test sessions for this test series`
//             );

            if (testSessions.length > 0) {
              // ✅ FIXED: Group by user and get FIRST ATTEMPT only
              const userFirstAttempts = {};
              testSessions.forEach((session) => {
                const userId = session.user_id;
                if (
                  !userFirstAttempts[userId] ||
                  new Date(session.completed_at) < new Date(userFirstAttempts[userId].completed_at)
                ) {
                  userFirstAttempts[userId] = session;
                }
              });

              // Convert to array and sort by FIRST ATTEMPT score
              const sortedSessions = Object.values(userFirstAttempts)
                .sort((a, b) => {
                  // Primary: Score descending
                  if (b.calculated_score !== a.calculated_score) {
                    return parseFloat(b.calculated_score) - parseFloat(a.calculated_score);
                  }
                  // Tiebreaker: Earlier completion wins
                  return new Date(a.completed_at) - new Date(b.completed_at);
                })
                .slice(0, parseInt(limit));

              // console.log(
//                 `✅ Found ${sortedSessions.length} unique users (ranked by FIRST ATTEMPT) - Fallback from TestSession`
//               );
              const totalUser = sortedSessions?.length

              leaderboardData = sortedSessions.map((session, index) => ({
                rank: index + 1,
                userId: session.user_id,
                name: session.user.username,
                totalScore: Math.round(
                  parseFloat(session.calculated_score) || 0
                ),
                finalScore: session.final_score,
                percentage: Math.round(
                  ((session.total_correct || 0) /
                    (session.total_questions || 1)) *
                  100
                ),
                correctAnswers: session.total_correct || 0,
                totalQuestions: session.total_questions || 0,
                wrongAnswers: session.total_wrong || 0,
                percentile: (((totalUser - (index + 1) + 1) / totalUser) * 100).toFixed(2),

                timeTaken:
                  Math.round(
                    (new Date(session.completed_at) -
                      new Date(session.started_at)) /
                    1000
                  ) || 0,
                completionDate: session.completed_at, // This is the first attempt date
                avatar:
                  session.user.avatarUrl || session.user.profileImage || null,
                testSeriesName: testSeries.name,
                isDemo: false,
              }));
            }
          } else {
            // console.log(`No test series found for UUID: ${testSeriesId}`);
          }
        }
      } catch (dbError) {
        // console.log("Error fetching test series leaderboard:", dbError.message);
      }

      // Check if we have any test sessions in database at all
      if (leaderboardData.length === 0) {
        // console.log(
//           "No test sessions found for specific test series. This suggests:"
//         );
        // console.log("1. No tests have been completed in this test series yet");
        // console.log("2. The quiz was taken using a different/older system");
        // console.log(
//           "3. The test series UUID in the URL does not match any real test series"
//         );
      }

      // If still no real data, return empty leaderboard instead of fake demo data
      if (leaderboardData.length === 0) {
        // console.log(
//           "No real test sessions found for this test series - returning empty leaderboard"
//         );

        res.json({
          success: true,
          message: "No participants found for this test series yet",
          data: [],
          testSeriesId: testSeriesId,
          metadata: {
            total: 0,
            limit: parseInt(limit),
            dataSource: "empty",
            message: "Be the first to take a test in this series!",
          },
        });
        return;
      }

      res.json({
        success: true,
        message: `Test series leaderboard retrieved successfully (${leaderboardData.length} participants)`,
        data: leaderboardData,
        testSeriesId: testSeriesId,
        metadata: {
          total: leaderboardData.length,
          limit: parseInt(limit),
          dataSource: "real",
          currentUserData: req.decodedToken
        },
      });
    } catch (error) {
      console.error("Test series leaderboard error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve test series leaderboard",
      });
    }
  }
}

module.exports = LeaderboardController;
