const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { User, TestSession, Test, Subscription, TestSeries } = require('../models');
const { authToken } = require('../utils/AuthToken');
const { Sequelize, Op } = require('sequelize');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.user.uuid}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (increased)
    files: 1, // Only 1 file
    fieldSize: 100 * 1024, // 100KB for text fields
    fieldNameSize: 100, // Field name limit
    fields: 10 // Max 10 fields
  },
  fileFilter: (req, file, cb) => {
    // console.log('🔍 File filter called:', { 
//       originalname: file.originalname, 
//       mimetype: file.mimetype,
//       fieldname: file.fieldname 
//     });
    
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      // console.log('✅ File allowed');
      return cb(null, true);
    } else {
      // console.log('❌ File rejected');
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get user profile with statistics
router.get('/profile', authToken, async (req, res) => {
  try {
    const user = await User.findOne({
      where: { uuid: req.user.uuid },
      attributes: [
        'uuid', 'username', 'email', 'fullName', 'phoneNumber',
        'dateOfBirth', 'schoolName', 'city', 'state', 'avatarUrl',
        'isEmailVerified', 'created_at', 'updated_at'
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user statistics
    const stats = await getUserStatistics(user.uuid);

    // Convert avatar URL to full URL if it's a local path
    const userData = user.toJSON();
    if (userData.avatarUrl && userData.avatarUrl.startsWith('/uploads/')) {
      userData.avatarUrl = `${req.protocol}://${req.get('host')}${userData.avatarUrl}`;
    }

    res.json({
      success: true,
      data: {
        ...userData,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// Add error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  // console.log('🚨 Multer error occurred:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }
  return res.status(500).json({
    success: false,
    message: `Unexpected error: ${err.message}`
  });
};

// Update user profile
router.put('/profile', authToken, (req, res, next) => {
  // console.log('🔄 Profile update request received');
  // console.log('📄 Headers:', req.headers);
  // console.log('📏 Content-Length:', req.headers['content-length']);
  // console.log('🔗 Content-Type:', req.headers['content-type']);
  next();
}, (req, res, next) => {
  // Check if this is a base64 avatar upload (JSON request)
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    // console.log('📝 JSON request detected - bypassing multer');
    return next();
  }
  // Otherwise use multer for multipart uploads
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req, res) => {
  try {
    // console.log('✅ Multer processing completed');
    // console.log('📁 File:', req.file);
    // console.log('📝 Body:', req.body);
    // console.log('🔍 Raw body type:', typeof req.body);
    
    const {
      fullName,
      phoneNumber,
      dateOfBirth,
      schoolName,
      city,
      state
    } = req.body;

    const updateData = {};

    // Only update fields that are provided
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (dateOfBirth !== undefined) {
      // Handle null or empty date values
      updateData.dateOfBirth = dateOfBirth === null || dateOfBirth === '' ? null : dateOfBirth;
    }
    if (schoolName !== undefined) updateData.schoolName = schoolName;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;

    // Handle avatar upload - both multipart file and base64
    if (req.file) {
      // Multipart file upload
      // console.log('🔄 Processing multipart file upload');
      const user = await User.findByPk(req.user.uuid);
      if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
        const oldAvatarPath = path.join(__dirname, '..', user.avatarUrl);
        try {
          await fs.unlink(oldAvatarPath);
        } catch (error) {
          // console.log('Error deleting old avatar:', error.message);
        }
      }
      updateData.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    } else if (req.body.avatarBase64) {
      // Base64 upload
      // console.log('🔄 Processing base64 avatar upload');
      try {
        const base64Data = req.body.avatarBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const fileBuffer = Buffer.from(base64Data, 'base64');
        
        // Create unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `avatar-${req.user.uuid}-${uniqueSuffix}.jpg`;
        const uploadsDir = path.join(__dirname, '../uploads/avatars');
        const filePath = path.join(uploadsDir, filename);
        
        // Ensure directory exists
        await fs.mkdir(uploadsDir, { recursive: true });
        
        // Save file
        await fs.writeFile(filePath, fileBuffer);
        
        // Delete old avatar if exists
        const user = await User.findByPk(req.user.uuid);
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
          const oldAvatarPath = path.join(__dirname, '..', user.avatarUrl);
          try {
            await fs.unlink(oldAvatarPath);
          } catch (error) {
            // console.log('Error deleting old avatar:', error.message);
          }
        }
        
        updateData.avatarUrl = `/uploads/avatars/${filename}`;
        // console.log('✅ Base64 avatar saved:', updateData.avatarUrl);
      } catch (error) {
        console.error('❌ Base64 avatar upload failed:', error);
        return res.status(400).json({
          success: false,
          message: 'Failed to process avatar image'
        });
      }
    }

    // Update user
    await User.update(updateData, {
      where: { uuid: req.user.uuid }
    });

    // Fetch updated user
    const updatedUser = await User.findOne({
      where: { uuid: req.user.uuid },
      attributes: [
        'uuid', 'username', 'email', 'fullName', 'phoneNumber',
        'dateOfBirth', 'schoolName', 'city', 'state', 'avatarUrl',
        'isEmailVerified', 'created_at', 'updated_at'
      ]
    });

    // Convert avatar URL to full URL if it's a local path
    const userData = updatedUser.toJSON();
    if (userData.avatarUrl && userData.avatarUrl.startsWith('/uploads/')) {
      userData.avatarUrl = `${req.protocol}://${req.get('host')}${userData.avatarUrl}`;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: userData
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Get user test history
router.get('/profile/test-history', authToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: sessions } = await TestSession.findAndCountAll({
      where: {
        user_id: req.user.uuid,
        status: 'completed'
      },
      include: [{
        model: Test,
        as: 'test',
        attributes: ['id', 'uuid', 'title', 'duration_minutes', 'total_marks']
      }],
      order: [['completed_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Calculate scores for each session
    const sessionsWithScores = await Promise.all(
      sessions.map(async (session) => {
        const score = await calculateSessionScore(session.id);
        return {
          id: session.id,
          uuid: session.uuid,
          test: session.test,
          start_time: session.start_time,
          completed_at: session.completed_at,
          time_taken: session.time_taken,
          score: score.obtained,
          total_marks: score.total,
          percentage: score.percentage,
          correct_answers: score.correct,
          wrong_answers: score.wrong,
          unanswered: score.unanswered
        };
      })
    );

    res.json({
      success: true,
      data: {
        sessions: sessionsWithScores,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching test history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test history',
      error: error.message
    });
  }
});

// Get user subscriptions
router.get('/profile/subscriptions', authToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.findAll({
      where: {
        user_id: req.user.uuid,
        status: 'completed'
      },
      include: [{
        model: TestSeries,
        as: 'testSeries',
        attributes: ['id', 'uuid', 'name', 'description', 'price']
      }],
      order: [['created_at', 'DESC']]
    });

    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      test_series: sub.testSeries,
      start_date: sub.start_date,
      expiry_date: sub.expiry_date,
      is_active: sub.expiry_date ? new Date(sub.expiry_date) > new Date() : true,
      transaction_id: sub.transaction_id,
      amount: sub.amount
    }));

    res.json({
      success: true,
      data: formattedSubscriptions
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
});

// Helper function to get user statistics
async function getUserStatistics(userUuid) {
  try {
    // Total tests completed
    const testsCompleted = await TestSession.count({
      where: {
        user_id: userUuid,
        status: 'completed'
      }
    });

    // Calculate average score
    const sessions = await TestSession.findAll({
      where: {
        user_id: userUuid,
        status: 'completed'
      }
    });

    let totalScore = 0;
    let totalPercentage = 0;
    let scoredSessions = 0;

    for (const session of sessions) {
      const score = await calculateSessionScore(session.id);
      if (score.total > 0) {
        totalScore += score.obtained;
        totalPercentage += score.percentage;
        scoredSessions++;
      }
    }

    const averageScore = scoredSessions > 0 ? totalPercentage / scoredSessions : 0;

    // Study hours (based on time spent in tests)
    let totalTimeSpent = 0;
    
    try {
      const completedSessions = await TestSession.findAll({
        where: {
          user_id: userUuid,
          status: 'completed',
          started_at: { [Op.ne]: null },
          completed_at: { [Op.ne]: null }
        },
        attributes: ['started_at', 'completed_at']
      });

      // Calculate total time spent by summing the differences
      totalTimeSpent = completedSessions.reduce((total, session) => {
        const startTime = new Date(session.started_at).getTime();
        const endTime = new Date(session.completed_at).getTime();
        const sessionTime = Math.max(0, (endTime - startTime) / 1000); // Convert to seconds
        return total + sessionTime;
      }, 0);
    } catch (error) {
      console.error('Error calculating total time spent:', error);
      totalTimeSpent = 0;
    }

    const studyHours = Math.round(totalTimeSpent / 3600); // Convert seconds to hours

    // Current streak (consecutive days with completed tests)
    const streak = await calculateStreak(userUuid);

    // User rank (simplified - based on average score)
    const rank = await calculateUserRank(userUuid, averageScore);

    return {
      testsCompleted,
      totalScore: Math.round(totalScore),
      averageScore: Math.round(averageScore * 10) / 10,
      rank,
      studyHours,
      streak
    };
  } catch (error) {
    console.error('Error calculating user statistics:', error);
    return {
      testsCompleted: 0,
      totalScore: 0,
      averageScore: 0,
      rank: 0,
      studyHours: 0,
      streak: 0
    };
  }
}

// Helper function to calculate session score
async function calculateSessionScore(sessionId) {
  const { UserAnswer, Question } = require('../models');
  
  const userAnswers = await UserAnswer.findAll({
    where: { test_session_id: sessionId },
    include: [{
      model: Question,
      as: 'question',
      attributes: ['correct_option', 'marks']
    }]
  });

  let correct = 0;
  let wrong = 0;
  let obtained = 0;
  let total = 0;

  userAnswers.forEach(answer => {
    if (answer.question) {
      total += answer.question.marks || 1;
      if (answer.selected_option === answer.question.correct_option) {
        correct++;
        obtained += answer.question.marks || 1;
      } else if (answer.selected_option) {
        wrong++;
      }
    }
  });

  const unanswered = await Question.count({
    include: [{
      model: Test,
      as: 'test',
      include: [{
        model: TestSession,
        as: 'sessions',
        where: { id: sessionId }
      }]
    }]
  }) - userAnswers.length;

  const percentage = total > 0 ? (obtained / total) * 100 : 0;

  return {
    correct,
    wrong,
    unanswered,
    obtained,
    total,
    percentage
  };
}

// Helper function to calculate streak
async function calculateStreak(userUuid) {
  const sessions = await TestSession.findAll({
    where: {
      user_id: userUuid,
      status: 'completed'
    },
    attributes: ['completed_at'],
    order: [['completed_at', 'DESC']]
  });

  if (sessions.length === 0) return 0;

  let streak = 1;
  let lastDate = new Date(sessions[0].completed_at);
  lastDate.setHours(0, 0, 0, 0);

  for (let i = 1; i < sessions.length; i++) {
    const currentDate = new Date(sessions[i].completed_at);
    currentDate.setHours(0, 0, 0, 0);
    
    const dayDiff = Math.floor((lastDate - currentDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      streak++;
      lastDate = currentDate;
    } else {
      break;
    }
  }

  return streak;
}

// Helper function to calculate user rank
async function calculateUserRank(userUuid, userAvgScore) {
  // Simple ranking based on average score
  // In a real app, this would be more sophisticated
  const betterUsers = await User.count({
    include: [{
      model: TestSession,
      as: 'testSessions',
      where: { status: 'completed' },
      required: true
    }],
    group: ['User.id'],
    having: Sequelize.literal(`AVG(CASE WHEN testSessions.status = 'completed' THEN 1 ELSE 0 END) > ${userAvgScore}`)
  });

  return (betterUsers?.length || 0) + 1;
}

module.exports = router;