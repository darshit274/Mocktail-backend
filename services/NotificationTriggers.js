const NotificationService = require('./NotificationService');
const { User, TestSeries, pdfs: Pdf } = require('../models');
const { Op } = require('sequelize');

class NotificationTriggers {
  
  /**
   * Send notification when a new free test is created
   */
  async onNewPracticeTestCreated(practiceTest) {
    try {
      // console.log('🔔 Triggering notification for new practice test:', practiceTest.title);

      // Get all active users who should receive notifications
      const users = await this.getNotificationEligibleUsers();
      
      if (users.length === 0) {
        // console.log('No eligible users for notification');
        return;
      }

      const userIds = users.map(user => user.uuid);

      const notificationData = {
        title: '🆕 New Free Test Available!',
        body: `"${practiceTest.title}" is now available. Start practicing for free!`,
        type: 'new_content',
        data: {
          content_type: 'free_test',
          content_id: practiceTest.uuid,
          test_title: practiceTest.title,
          test_category: practiceTest.test_type,
          navigation: 'free-tests',
          navigationData: {
            testId: practiceTest.uuid,
            category: practiceTest.test_type
          }
        },
        priority: 'high'
      };

      // Send to all eligible users
      const result = await NotificationService.sendNotificationToUsers(userIds, notificationData);
      
      // console.log(`✅ Free test notification sent to ${result.successful_sends} users`);
      return result;

    } catch (error) {
      console.error('❌ Error triggering free test notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification when a new test series is created
   */
  async onNewTestSeriesCreated(testSeries) {
    try {
      // console.log('🔔 Triggering notification for new test series:', testSeries.title);

      // Get all active users
      const users = await this.getNotificationEligibleUsers();
      
      if (users.length === 0) {
        // console.log('No eligible users for notification');
        return;
      }

      const userIds = users.map(user => user.uuid);

      // Determine if it's free or paid
      const isFree = testSeries.price === 0 || testSeries.is_free;
      const priceText = isFree ? 'Free' : `₹${testSeries.price}`;
      const emoji = isFree ? '🎉' : '🌟';

      const notificationData = {
        title: `${emoji} New Test Series: ${testSeries.title}`,
        body: `${testSeries.total_tests} tests available${isFree ? ' for FREE!' : ` at ${priceText}`}. ${testSeries.description || 'Check it out now!'}`,
        type: 'new_content',
        data: {
          content_type: 'test_series',
          content_id: testSeries.uuid,
          series_title: testSeries.title,
          series_category: testSeries.category,
          is_free: isFree,
          price: testSeries.price,
          navigation: 'test-series',
          navigationData: {
            seriesId: testSeries.uuid,
            category: testSeries.category
          }
        },
        priority: 'high'
      };

      // Send to all eligible users
      const result = await NotificationService.sendNotificationToUsers(userIds, notificationData);
      
      // console.log(`✅ Test series notification sent to ${result.successful_sends} users`);
      return result;

    } catch (error) {
      console.error('❌ Error triggering test series notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification when a new PDF is uploaded
   */
  async onNewPdfCreated(pdf) {
    try {
      // console.log('🔔 Triggering notification for new PDF:', pdf.title);

      // Get all active users
      const users = await this.getNotificationEligibleUsers();
      
      if (users.length === 0) {
        // console.log('No eligible users for notification');
        return;
      }

      const userIds = users.map(user => user.uuid);

      const notificationData = {
        title: '📚 New Study Material Available!',
        body: `"${pdf.title}" has been added to the library. ${pdf.description || 'Download now!'}`,
        type: 'new_content',
        data: {
          content_type: 'pdf',
          content_id: pdf.uuid,
          pdf_title: pdf.title,
          pdf_category: pdf.category,
          navigation: 'pdfs',
          navigationData: {
            pdfId: pdf.uuid,
            category: pdf.category
          }
        },
        priority: 'default'
      };

      // Send to all eligible users
      const result = await NotificationService.sendNotificationToUsers(userIds, notificationData);
      
      // console.log(`✅ PDF notification sent to ${result.successful_sends} users`);
      return result;

    } catch (error) {
      console.error('❌ Error triggering PDF notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification when a test series gets a special offer
   */
  async onTestSeriesSpecialOffer(testSeries, offerDetails) {
    try {
      // console.log('🔔 Triggering special offer notification:', testSeries.title);

      const users = await this.getNotificationEligibleUsers();
      
      if (users.length === 0) {
        // console.log('No eligible users for notification');
        return;
      }

      const userIds = users.map(user => user.uuid);

      const discountPercent = Math.round(((offerDetails.originalPrice - offerDetails.offerPrice) / offerDetails.originalPrice) * 100);

      const notificationData = {
        title: `💰 ${discountPercent}% OFF on ${testSeries.title}!`,
        body: `Limited time offer! Get this test series at just ₹${offerDetails.offerPrice} (Original: ₹${offerDetails.originalPrice})`,
        type: 'subscription',
        data: {
          content_type: 'special_offer',
          series_id: testSeries.uuid,
          series_title: testSeries.title,
          original_price: offerDetails.originalPrice,
          offer_price: offerDetails.offerPrice,
          discount_percent: discountPercent,
          offer_ends_at: offerDetails.endsAt,
          navigation: 'test-series',
          navigationData: {
            seriesId: testSeries.uuid,
            showOffer: true
          }
        },
        priority: 'high'
      };

      const result = await NotificationService.sendNotificationToUsers(userIds, notificationData);
      
      // console.log(`✅ Special offer notification sent to ${result.successful_sends} users`);
      return result;

    } catch (error) {
      console.error('❌ Error triggering special offer notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification for bulk content update (multiple items)
   */
  async onBulkContentAdded(contentSummary) {
    try {
      // console.log('🔔 Triggering bulk content notification');

      const users = await this.getNotificationEligibleUsers();
      
      if (users.length === 0) {
        // console.log('No eligible users for notification');
        return;
      }

      const userIds = users.map(user => user.uuid);

      let bodyText = [];
      if (contentSummary.freeTests > 0) {
        bodyText.push(`${contentSummary.freeTests} new free tests`);
      }
      if (contentSummary.testSeries > 0) {
        bodyText.push(`${contentSummary.testSeries} new test series`);
      }
      if (contentSummary.pdfs > 0) {
        bodyText.push(`${contentSummary.pdfs} new PDFs`);
      }

      const notificationData = {
        title: '🎊 New Content Alert!',
        body: `We've added ${bodyText.join(', ')} to help you prepare better. Check them out now!`,
        type: 'new_content',
        data: {
          content_type: 'bulk_update',
          summary: contentSummary,
          navigation: 'home',
          navigationData: {}
        },
        priority: 'default'
      };

      const result = await NotificationService.sendNotificationToUsers(userIds, notificationData);
      
      // console.log(`✅ Bulk content notification sent to ${result.successful_sends} users`);
      return result;

    } catch (error) {
      console.error('❌ Error triggering bulk content notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get users eligible for notifications
   */
  async getNotificationEligibleUsers(filters = {}) {
    try {
      const whereClause = {
        is_active: true,
        email_verified: true,
        ...filters
      };

      const users = await User.findAll({
        where: whereClause,
        attributes: ['uuid', 'email', 'name'],
        raw: true
      });

      return users;

    } catch (error) {
      console.error('Error getting eligible users:', error);
      return [];
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   * This can be expanded to check user notification preferences
   */
  async shouldSendNotification(userId, notificationType) {
    // For now, return true. This can be expanded to check user preferences
    return true;
  }

  /**
   * Schedule a notification for later
   */
  async scheduleNotification(notificationData, scheduledTime) {
    try {
      // This could be implemented with a job queue like Bull or node-cron
      // console.log(`📅 Notification scheduled for ${scheduledTime}`);
      
      // For now, we'll just log it
      // In production, you'd want to use a proper job queue
      
      return { success: true, scheduled: true };

    } catch (error) {
      console.error('Error scheduling notification:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new NotificationTriggers();