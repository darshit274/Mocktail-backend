const NotificationService = require('./NotificationService');
const NotificationTriggers = require('./NotificationTriggers');
const cron = require('node-cron');
const { User, Test, TestSeries, subscription: Subscription } = require('../models');
const { Op } = require('sequelize');

class NotificationScheduler {
  constructor() {
    this.scheduledJobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the notification scheduler
   */
  initialize() {
    if (this.isInitialized) return;

    // console.log('🕒 Initializing Notification Scheduler...');

    // Schedule daily digest notifications (8 AM)
    cron.schedule('0 8 * * *', () => {
      this.sendDailyDigest();
    });

    // Schedule weekly engagement notifications (Monday 10 AM)
    cron.schedule('0 10 * * 1', () => {
      this.sendWeeklyEngagementNotifications();
    });

    // Schedule reminder for inactive users (Every 3 days at 6 PM)
    cron.schedule('0 18 */3 * *', () => {
      this.sendInactiveUserReminders();
    });

    // Check for upcoming test reminders every hour
    cron.schedule('0 * * * *', () => {
      this.checkUpcomingTestReminders();
    });

    // Send new content summary every Monday at 9 AM
    cron.schedule('0 9 * * 1', () => {
      this.sendWeeklyContentSummary();
    });

    this.isInitialized = true;
    // console.log('✅ Notification Scheduler initialized successfully');
  }

  /**
   * Send daily digest to active users
   */
  async sendDailyDigest() {
    try {
      // console.log('📊 Sending daily digest notifications...');

      // Get users who were active in the last 7 days
      const activeUsers = await User.findAll({
        where: {
          is_active: true,
          email_verified: true,
          last_login: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        attributes: ['uuid', 'email', 'name'],
        limit: 100 // Limit to prevent overwhelming
      });

      if (activeUsers.length === 0) return;

      // Get recent content stats
      const recentPracticeTests = await Test.count({
        where: {
          test_type: 'practice',
          is_active: true,
          created_at: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      const recentTestSeries = await TestSeries.count({
        where: {
          is_active: true,
          created_at: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      if (recentPracticeTests === 0 && recentTestSeries === 0) {
        // console.log('No new content to notify about today');
        return;
      }

      const userIds = activeUsers.map(user => user.uuid);

      let digestContent = [];
      if (recentPracticeTests > 0) {
        digestContent.push(`${recentPracticeTests} new practice tests`);
      }
      if (recentTestSeries > 0) {
        digestContent.push(`${recentTestSeries} new test series`);
      }

      const notificationData = {
        title: '📅 Daily Digest - New Content Available!',
        body: `Good morning! We've added ${digestContent.join(' and ')} in the last 24 hours. Keep practicing!`,
        type: 'new_content',
        priority: 'default'
      };

      await NotificationService.sendNotificationToUsers(userIds, notificationData);
      // console.log(`✅ Daily digest sent to ${userIds.length} active users`);

    } catch (error) {
      console.error('❌ Error sending daily digest:', error);
    }
  }

  /**
   * Send weekly engagement notifications
   */
  async sendWeeklyEngagementNotifications() {
    try {
      // console.log('📈 Sending weekly engagement notifications...');

      // Get users who haven't taken a test in the last week
      const inactiveUsers = await User.findAll({
        where: {
          is_active: true,
          email_verified: true,
          // This would need proper implementation with user activity tracking
          last_login: {
            [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        attributes: ['uuid', 'email', 'name'],
        limit: 50
      });

      if (inactiveUsers.length === 0) return;

      const userIds = inactiveUsers.map(user => user.uuid);

      const notificationData = {
        title: '🎯 Weekly Challenge - Come Back!',
        body: "It's been a week since your last practice session. Come back and improve your skills with new tests!",
        type: 'general',
        data: {
          challenge_type: 'weekly_comeback',
          navigation: 'free-tests'
        },
        priority: 'default'
      };

      await NotificationService.sendNotificationToUsers(userIds, notificationData);
      // console.log(`✅ Weekly engagement notifications sent to ${userIds.length} users`);

    } catch (error) {
      console.error('❌ Error sending weekly engagement notifications:', error);
    }
  }

  /**
   * Send reminders to inactive users
   */
  async sendInactiveUserReminders() {
    try {
      // console.log('💤 Sending inactive user reminders...');

      // Get users inactive for 3+ days
      const inactiveUsers = await User.findAll({
        where: {
          is_active: true,
          email_verified: true,
          last_login: {
            [Op.lt]: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            [Op.gt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // But not too old
          }
        },
        attributes: ['uuid', 'email', 'name'],
        limit: 30
      });

      if (inactiveUsers.length === 0) return;

      const userIds = inactiveUsers.map(user => user.uuid);

      const notificationData = {
        title: '🚀 Ready for Your Next Challenge?',
        body: "Don't lose momentum! Continue your preparation journey with our latest tests and study materials.",
        type: 'general',
        data: {
          reminder_type: 'comeback',
          navigation: 'home'
        },
        priority: 'default'
      };

      await NotificationService.sendNotificationToUsers(userIds, notificationData);
      // console.log(`✅ Inactive user reminders sent to ${userIds.length} users`);

    } catch (error) {
      console.error('❌ Error sending inactive user reminders:', error);
    }
  }

  /**
   * Check for upcoming test reminders
   */
  async checkUpcomingTestReminders() {
    try {
      // This would be implemented if you have scheduled tests
      // For now, we'll send general practice reminders to active users
      
      const now = new Date();
      const hour = now.getHours();

      // Send practice reminders at specific times (9 AM, 2 PM, 7 PM)
      if ([9, 14, 19].includes(hour)) {
        const recentlyActiveUsers = await User.findAll({
          where: {
            is_active: true,
            email_verified: true,
            last_login: {
              [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          },
          attributes: ['uuid'],
          limit: 20 // Limit to prevent spam
        });

        if (recentlyActiveUsers.length > 0) {
          const userIds = recentlyActiveUsers.map(user => user.uuid);

          const timeGreeting = hour === 9 ? 'Good morning' : hour === 14 ? 'Good afternoon' : 'Good evening';
          
          const notificationData = {
            title: `⏰ ${timeGreeting}! Time to Practice`,
            body: 'Take a quick test to sharpen your skills. Even 15 minutes of practice makes a difference!',
            type: 'quiz_reminder',
            data: {
              reminder_type: 'practice_time',
              navigation: 'free-tests'
            },
            priority: 'default'
          };

          // Send to a subset to avoid overwhelming users
          const selectedUsers = userIds.slice(0, 10);
          await NotificationService.sendNotificationToUsers(selectedUsers, notificationData);
          // console.log(`✅ Practice reminders sent to ${selectedUsers.length} users at ${hour}:00`);
        }
      }

    } catch (error) {
      console.error('❌ Error checking upcoming test reminders:', error);
    }
  }

  /**
   * Send weekly content summary
   */
  async sendWeeklyContentSummary() {
    try {
      // console.log('📋 Sending weekly content summary...');

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get content added in the last week
      const [weeklyPracticeTests, weeklyTestSeries] = await Promise.all([
        Test.count({
          where: {
            test_type: 'practice',
            is_active: true,
            created_at: { [Op.gte]: oneWeekAgo }
          }
        }),
        TestSeries.count({
          where: {
            is_active: true,
            created_at: { [Op.gte]: oneWeekAgo }
          }
        })
      ]);

      if (weeklyPracticeTests === 0 && weeklyTestSeries === 0) {
        // console.log('No new content this week to summarize');
        return;
      }

      const contentSummary = {
        practiceTests: weeklyPracticeTests,
        testSeries: weeklyTestSeries,
        pdfs: 0 // Could be implemented
      };

      await NotificationTriggers.onBulkContentAdded(contentSummary);
      // console.log(`✅ Weekly content summary sent: ${weeklyPracticeTests} practice tests, ${weeklyTestSeries} test series`);

    } catch (error) {
      console.error('❌ Error sending weekly content summary:', error);
    }
  }

  /**
   * Schedule a one-time notification
   */
  async scheduleOneTimeNotification(notificationData, scheduleTime, jobId) {
    try {
      const cronExpression = this.convertDateToCron(scheduleTime);
      
      const job = cron.schedule(cronExpression, async () => {
        try {
          // console.log(`📅 Executing scheduled notification: ${jobId}`);
          
          const users = await NotificationTriggers.getNotificationEligibleUsers();
          const userIds = users.map(user => user.uuid);
          
          await NotificationService.sendNotificationToUsers(userIds, notificationData);
          
          // Remove the job after execution
          this.cancelScheduledNotification(jobId);
          
          // console.log(`✅ Scheduled notification executed: ${jobId}`);
        } catch (error) {
          console.error(`❌ Error executing scheduled notification ${jobId}:`, error);
        }
      }, {
        scheduled: false // Don't start immediately
      });

      this.scheduledJobs.set(jobId, job);
      job.start();

      // console.log(`✅ Notification scheduled for ${scheduleTime} with ID: ${jobId}`);
      return { success: true, jobId };

    } catch (error) {
      console.error(`❌ Error scheduling notification ${jobId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel a scheduled notification
   */
  cancelScheduledNotification(jobId) {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      job.destroy();
      this.scheduledJobs.delete(jobId);
      // console.log(`✅ Cancelled scheduled notification: ${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * Convert Date to cron expression (for one-time execution)
   */
  convertDateToCron(date) {
    const d = new Date(date);
    return `${d.getMinutes()} ${d.getHours()} ${d.getDate()} ${d.getMonth() + 1} *`;
  }

  /**
   * Get scheduled notifications count
   */
  getScheduledNotificationsCount() {
    return this.scheduledJobs.size;
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    this.scheduledJobs.forEach((job, jobId) => {
      job.destroy();
      // console.log(`🛑 Stopped job: ${jobId}`);
    });
    this.scheduledJobs.clear();
    // console.log('🛑 All scheduled notification jobs stopped');
  }
}

// Export singleton instance
module.exports = new NotificationScheduler();