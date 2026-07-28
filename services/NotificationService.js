const { 
  sendPushNotification, 
  sendMulticastPushNotification, 
  sendTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic 
} = require('../config/firebase');
const { User, Notification, PushToken } = require('../models');
const { Op } = require('sequelize');

class NotificationService {
  
  /**
   * Send notification to a specific user
   */
  async sendNotificationToUser(userId, notificationData) {
    try {
      // Get user's push tokens
      const pushTokens = await PushToken.findAll({
        where: { 
          user_id: userId, 
          is_active: true,
          expires_at: { [Op.gt]: new Date() }
        }
      });

      if (pushTokens.length === 0) {
        // console.log(`No active push tokens found for user ${userId}`);
        return { success: false, reason: 'No active push tokens' };
      }

      // Store notification in database
      const notification = await Notification.create({
        user_id: userId,
        title: notificationData.title,
        body: notificationData.body,
        type: notificationData.type || 'general',
        data: notificationData.data ? JSON.stringify(notificationData.data) : null,
        status: 'sent',
        sent_at: new Date(),
      });

      // Send push notification to all user's devices
      const tokens = pushTokens.map(pt => pt.push_token);
      const payload = {
        title: notificationData.title,
        body: notificationData.body,
        data: {
          ...notificationData.data,
          notification_id: notification.id.toString(),
          type: notificationData.type || 'general',
        },
        priority: notificationData.priority || 'high',
        channelId: this.getChannelId(notificationData.type),
        badge: notificationData.badge || 1,
      };

      const result = await sendMulticastPushNotification(tokens, payload);

      // Update notification status based on result
      if (result.success && result.successCount > 0) {
        await notification.update({ 
          status: 'delivered',
          delivered_at: new Date()
        });
      } else {
        await notification.update({ status: 'failed' });
      }

      return {
        success: result.success,
        notification_id: notification.id,
        devices_reached: result.successCount || 0,
        devices_failed: result.failureCount || 0,
      };

    } catch (error) {
      console.error('Error sending notification to user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendNotificationToUsers(userIds, notificationData) {
    try {
      const results = [];
      
      // Process users in batches to avoid overwhelming Firebase
      const batchSize = 100;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const batchPromises = batch.map(userId => 
          this.sendNotificationToUser(userId, notificationData)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      }

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      return {
        success: true,
        total_users: userIds.length,
        successful_sends: successful,
        failed_sends: failed,
      };

    } catch (error) {
      console.error('Error sending notifications to multiple users:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send broadcast notification to all users
   */
  async sendBroadcastNotification(notificationData, filters = {}) {
    try {
      // Get all users based on filters
      const whereClause = { is_active: true };
      
      if (filters.subscription_status) {
        whereClause.subscription_status = filters.subscription_status;
      }
      
      if (filters.user_type) {
        whereClause.user_type = filters.user_type;
      }

      const users = await User.findAll({
        where: whereClause,
        attributes: ['uuid'],
      });

      if (users.length === 0) {
        return { success: false, reason: 'No users found matching criteria' };
      }

      const userIds = users.map(user => user.uuid);
      
      // Use topic-based messaging for broadcast if available
      if (!filters.subscription_status && !filters.user_type) {
        return await this.sendTopicNotification('all_users', notificationData);
      }

      return await this.sendNotificationToUsers(userIds, notificationData);

    } catch (error) {
      console.error('Error sending broadcast notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send topic-based notification
   */
  async sendTopicNotification(topic, notificationData) {
    try {
      // Store notification for tracking
      const notification = await Notification.create({
        user_id: null, // Topic notifications don't have specific user
        title: notificationData.title,
        body: notificationData.body,
        type: notificationData.type || 'general',
        data: notificationData.data ? JSON.stringify(notificationData.data) : null,
        topic: topic,
        status: 'sent',
        sent_at: new Date(),
      });

      const payload = {
        title: notificationData.title,
        body: notificationData.body,
        data: {
          ...notificationData.data,
          notification_id: notification.id.toString(),
          type: notificationData.type || 'general',
        },
        priority: notificationData.priority || 'high',
        channelId: this.getChannelId(notificationData.type),
        badge: notificationData.badge || 1,
      };

      const result = await sendTopicNotification(topic, payload);

      // Update notification status
      if (result.success) {
        await notification.update({ 
          status: 'delivered',
          delivered_at: new Date()
        });
      } else {
        await notification.update({ status: 'failed' });
      }

      return {
        success: result.success,
        notification_id: notification.id,
        topic: topic,
      };

    } catch (error) {
      console.error(`Error sending topic notification to ${topic}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register user's push token
   */
  async registerPushToken(userId, tokenData) {
    try {
      const { pushToken, platform, deviceInfo } = tokenData;

      // Check if token already exists
      const existingToken = await PushToken.findOne({
        where: { push_token: pushToken }
      });

      if (existingToken) {
        // Update existing token
        await existingToken.update({
          user_id: userId,
          platform: platform,
          device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
          is_active: true,
          updated_at: new Date(),
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        });

        // console.log(`✅ Updated existing push token for user ${userId}`);
      } else {
        // Create new token
        await PushToken.create({
          user_id: userId,
          push_token: pushToken,
          platform: platform,
          device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
          is_active: true,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        });

        // console.log(`✅ Registered new push token for user ${userId}`);
      }

      // Subscribe to relevant topics
      await this.subscribeUserToTopics(userId, pushToken);

      return { success: true };

    } catch (error) {
      console.error('Error registering push token:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe user to relevant topics
   */
  async subscribeUserToTopics(userId, pushToken) {
    try {
      const topics = ['all_users'];

      // Get user details to determine additional topics
      const user = await User.findOne({
        where: { uuid: userId },
        attributes: ['user_type', 'subscription_status']
      });

      if (user) {
        if (user.user_type === 'premium') {
          topics.push('premium_users');
        }
        
        if (user.subscription_status === 'active') {
          topics.push('subscribed_users');
        }
      }

      // Subscribe to topics
      for (const topic of topics) {
        await subscribeToTopic([pushToken], topic);
      }

      // console.log(`✅ Subscribed user ${userId} to topics:`, topics);

    } catch (error) {
      console.error('Error subscribing user to topics:', error);
    }
  }

  /**
   * Send quiz reminder notification
   */
  async sendQuizReminder(userId, quizData) {
    const notificationData = {
      title: '📚 Quiz Reminder',
      body: `Don't forget to take "${quizData.title}" - ${quizData.timeLeft} left!`,
      type: 'quiz_reminder',
      data: {
        quiz_id: quizData.id,
        quiz_type: quizData.type,
        navigation: 'quiz',
        navigationData: {
          testId: quizData.id,
          testType: quizData.type,
        }
      },
      priority: 'high',
    };

    return await this.sendNotificationToUser(userId, notificationData);
  }

  /**
   * Send test result notification
   */
  async sendTestResultNotification(userId, resultData) {
    const passed = resultData.percentage >= resultData.passPercentage;
    const emoji = passed ? '🎉' : '📈';
    const status = passed ? 'Congratulations! You passed' : 'Keep practicing';

    const notificationData = {
      title: `${emoji} Test Result Available`,
      body: `${status} - ${resultData.percentage}% in "${resultData.testTitle}"`,
      type: 'test_result',
      data: {
        result_id: resultData.resultId,
        session_id: resultData.sessionId,
        navigation: 'results',
        navigationData: {
          resultId: resultData.resultId,
          sessionId: resultData.sessionId,
        }
      },
      priority: 'high',
    };

    return await this.sendNotificationToUser(userId, notificationData);
  }

  /**
   * Send new content notification
   */
  async sendNewContentNotification(contentData, targetUsers = 'all') {
    const notificationData = {
      title: '🆕 New Content Available',
      body: `${contentData.type}: "${contentData.title}" is now available!`,
      type: 'new_content',
      data: {
        content_id: contentData.id,
        content_type: contentData.type,
        navigation: contentData.type === 'test' ? 'free-tests' : 'test-series',
        navigationData: {
          category: contentData.category,
        }
      },
      priority: 'default',
    };

    if (targetUsers === 'all') {
      return await this.sendBroadcastNotification(notificationData);
    } else {
      return await this.sendNotificationToUsers(targetUsers, notificationData);
    }
  }

  /**
   * Get notification channel ID based on type
   */
  getChannelId(type) {
    const channelMap = {
      'quiz_reminder': 'quiz_reminders',
      'test_result': 'test_results',
      'new_content': 'new_content',
      'subscription': 'subscription',
      'general': 'general',
    };

    return channelMap[type] || 'general';
  }

  /**
   * Get user's notification history
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const { page = 1, limit = 20, type } = options;
      const offset = (page - 1) * limit;

      const whereClause = { user_id: userId };
      if (type) {
        whereClause.type = type;
      }

      const { count, rows } = await Notification.findAndCountAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: [
          'id', 'title', 'body', 'type', 'data', 'status',
          'read_at', 'sent_at', 'delivered_at', 'created_at'
        ]
      });

      return {
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        }
      };

    } catch (error) {
      console.error('Error getting user notifications:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { 
          id: notificationId, 
          user_id: userId 
        }
      });

      if (!notification) {
        return { success: false, error: 'Notification not found' };
      }

      await notification.update({ 
        read_at: new Date(),
        status: 'read'
      });

      return { success: true };

    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up expired push tokens
   */
  async cleanupExpiredTokens() {
    try {
      const deletedCount = await PushToken.destroy({
        where: {
          [Op.or]: [
            { expires_at: { [Op.lt]: new Date() } },
            { is_active: false }
          ]
        }
      });

      // console.log(`🧹 Cleaned up ${deletedCount} expired push tokens`);
      return { success: true, deleted: deletedCount };

    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new NotificationService();