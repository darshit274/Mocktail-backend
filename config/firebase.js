const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let firebaseApp;

const initializeFirebase = () => {
  try {
    if (firebaseApp) {
      return firebaseApp;
    }

    // Check if running in production or development
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // In production, use service account key from environment variables
      const serviceAccount = {
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      };

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      // In development, try to use service account key file
      const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
      
      try {
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
          projectId: process.env.FIREBASE_PROJECT_ID || 'your-firebase-project-id',
        });
      } catch (error) {
        console.warn('⚠️  Firebase service account file not found. Using environment variables...');
        
        // Fallback to environment variables in development
        const serviceAccount = {
          type: process.env.FIREBASE_TYPE || 'service_account',
          project_id: process.env.FIREBASE_PROJECT_ID || 'your-firebase-project-id',
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
          token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
        };

        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID || 'your-firebase-project-id',
        });
      }
    }

    // console.log('✅ Firebase Admin SDK initialized successfully');
    return firebaseApp;

  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    // console.log('🔧 Please ensure you have properly configured Firebase credentials');
    // console.log('📋 Required environment variables:');
    // console.log('   - FIREBASE_PROJECT_ID');
    // console.log('   - FIREBASE_PRIVATE_KEY');
    // console.log('   - FIREBASE_CLIENT_EMAIL');
    // console.log('   Or place firebase-service-account.json in the config directory');
    
    return null;
  }
};

// Get Firebase Messaging instance
const getMessaging = () => {
  const app = getFirebaseApp();
  if (!app) return null;
  
  try {
    return admin.messaging(app);
  } catch (error) {
    console.error('❌ Failed to get Firebase Messaging instance:', error);
    return null;
  }
};

// Get Firebase App instance
const getFirebaseApp = () => {
  if (!firebaseApp) {
    firebaseApp = initializeFirebase();
  }
  return firebaseApp;
};

// Send push notification to a single device
const sendPushNotification = async (token, payload) => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      throw new Error('Firebase Messaging not initialized');
    }

    const message = {
      token: token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data || {},
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#FF6B35',
          sound: 'default',
          priority: payload.priority || 'high',
          channelId: payload.channelId || 'default',
        },
        data: payload.data || {},
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            badge: payload.badge || 1,
            sound: 'default',
            'content-available': 1,
          },
        },
        headers: {
          'apns-priority': payload.priority === 'high' ? '10' : '5',
        },
      },
    };

    const response = await messaging.send(message);
    // console.log('✅ Push notification sent successfully:', response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('❌ Failed to send push notification:', error);
    return { success: false, error: error.message };
  }
};

// Send push notification to multiple devices
const sendMulticastPushNotification = async (tokens, payload) => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      throw new Error('Firebase Messaging not initialized');
    }

    if (!tokens || tokens.length === 0) {
      throw new Error('No tokens provided');
    }

    const message = {
      tokens: tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data || {},
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#FF6B35',
          sound: 'default',
          priority: payload.priority || 'high',
          channelId: payload.channelId || 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            badge: payload.badge || 1,
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.sendMulticast(message);
    
    // console.log(`✅ Multicast notification sent: ${response.successCount}/${tokens.length} successful`);
    
    if (response.failureCount > 0) {
      console.warn(`⚠️  ${response.failureCount} notifications failed`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed to send to token ${idx}:`, resp.error);
        }
      });
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
    };

  } catch (error) {
    console.error('❌ Failed to send multicast push notification:', error);
    return { success: false, error: error.message };
  }
};

// Send notification to a topic
const sendTopicNotification = async (topic, payload) => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      throw new Error('Firebase Messaging not initialized');
    }

    const message = {
      topic: topic,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data || {},
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#FF6B35',
          sound: 'default',
          priority: payload.priority || 'high',
          channelId: payload.channelId || 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            badge: payload.badge || 1,
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.send(message);
    // console.log(`✅ Topic notification sent to "${topic}":`, response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error(`❌ Failed to send topic notification to "${topic}":`, error);
    return { success: false, error: error.message };
  }
};

// Subscribe tokens to a topic
const subscribeToTopic = async (tokens, topic) => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      throw new Error('Firebase Messaging not initialized');
    }

    const response = await messaging.subscribeToTopic(tokens, topic);
    // console.log(`✅ Successfully subscribed ${response.successCount} tokens to topic "${topic}"`);
    
    if (response.failureCount > 0) {
      console.warn(`⚠️  Failed to subscribe ${response.failureCount} tokens to topic "${topic}"`);
    }

    return response;

  } catch (error) {
    console.error(`❌ Failed to subscribe to topic "${topic}":`, error);
    return { success: false, error: error.message };
  }
};

// Unsubscribe tokens from a topic
const unsubscribeFromTopic = async (tokens, topic) => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      throw new Error('Firebase Messaging not initialized');
    }

    const response = await messaging.unsubscribeFromTopic(tokens, topic);
    // console.log(`✅ Successfully unsubscribed ${response.successCount} tokens from topic "${topic}"`);
    
    if (response.failureCount > 0) {
      console.warn(`⚠️  Failed to unsubscribe ${response.failureCount} tokens from topic "${topic}"`);
    }

    return response;

  } catch (error) {
    console.error(`❌ Failed to unsubscribe from topic "${topic}":`, error);
    return { success: false, error: error.message };
  }
};

// Validate push token
const validatePushToken = async (token) => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      throw new Error('Firebase Messaging not initialized');
    }

    // Try to send a dry-run message to validate the token
    const message = {
      token: token,
      notification: {
        title: 'Test',
        body: 'Test',
      },
      dryRun: true, // This won't actually send the message
    };

    await messaging.send(message);
    return { valid: true };

  } catch (error) {
    console.error('❌ Token validation failed:', error);
    return { valid: false, error: error.message };
  }
};

module.exports = {
  initializeFirebase,
  getFirebaseApp,
  getMessaging,
  sendPushNotification,
  sendMulticastPushNotification,
  sendTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
  validatePushToken,
};