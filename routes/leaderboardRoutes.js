const express = require("express");
const router = express.Router();
const LeaderboardController = require("../controllers/LeaderboardController");
const authenticateToken = require("../middleware/authMiddleware");

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const AuthToken = require("../utils/AuthToken");
      const User = require("../models/User");

      const decoded = await AuthToken.verifyToken(token);
      req.decodedToken = decoded;
      try {
        const user = await User.findOne({ where: { uuid: decoded.uuid } });

        if (user) {
          req.user = {
            ...user.toJSON(),
            id: user.id,
            uuid: user.uuid,
          };
        }
      } catch (error) {
        // console.log(error);
      }
    }
    next();
  } catch (error) {
    next();
  }
};

// Leaderboard routes
router.get("/", optionalAuth, LeaderboardController.getLeaderboard);
router.get("/my-rank", authenticateToken, LeaderboardController.getUserRank);
router.get(
  "/test-series/:testSeriesId",
  optionalAuth,
  LeaderboardController.getTestSeriesLeaderboard
);

module.exports = router;
