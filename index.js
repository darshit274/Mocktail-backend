const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const router = require('./routes/index');
const serverless = require("serverless-http");
// Removed express-fileupload to avoid conflict with multer

const { sequelize } = require('./models'); // Assuming your sequelize export is CommonJS
const errorMiddleware = require('./utils/default/globalErrorHandler');
const { initializeFirebase } = require('./config/firebase');
const { validateConfig: validateRazorpayConfig } = require('./config/razorpay');
const NotificationScheduler = require('./services/NotificationScheduler');
dotenv.config();

// Centralised upload + timeout config (env-driven). Must be required AFTER dotenv.
const { EXPRESS_BODY_LIMIT, REQUEST_TIMEOUT_MS } = require('./utils/uploadConfig');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow all origins and methods
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: false, // Set to false when using origin: '*'
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));
// Trust proxy for devtunnels/ngrok
app.set('trust proxy', true);

// Handle preflight requests explicitly
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.status(200).send();
  } else {
    next();
  }
});

// Manual CORS headers middleware (fallback)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  next();
});

// Request logging middleware for debugging
app.use((req, res, next) => {
  // console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('origin') || 'No origin'}`);
  if (req.path.includes('/upload')) {
    // console.log('🚨 UPLOAD REQUEST DETECTED:');
    // console.log('  Path:', req.path);
    // console.log('  Method:', req.method);
    // console.log('  Content-Type:', req.get('content-type'));
    // console.log('  Content-Length:', req.get('content-length'));
  }
  next();
});

// Parse JSON bodies — limit is env-driven so it can match the upload size on prod
app.use(express.json({ limit: EXPRESS_BODY_LIMIT }));
app.use(express.urlencoded({ limit: EXPRESS_BODY_LIMIT, extended: true }));

// Bump per-request timeout for long-running endpoints (PDF upload). The
// `setTimeout` on req/res prevents Node's default 2-minute socket timeout from
// killing big uploads. nginx proxy_read_timeout still has to be at least this big.
app.use((req, res, next) => {
  if (req.path.includes('/upload') || req.path.endsWith('/upload')) {
    req.setTimeout(REQUEST_TIMEOUT_MS);
    res.setTimeout(REQUEST_TIMEOUT_MS);
  }
  next();
});

// File upload is handled by multer in individual controllers

// Serve static files
app.use('/uploads', express.static('uploads'));

// API routes
app.use('/api', router);

app.get('/', (req, res) => {
  res.send('🚀 API is running...');
});
app.use(errorMiddleware);
sequelize.authenticate().then(() => {
  // console.log('✅ Database connected.');
}).catch((error) => {
  console.error('❌ DB Connection error:', error);
});

async function startServer() {
  try {
    // Initialize Firebase Admin SDK
    initializeFirebase();

    // Validate Razorpay configuration
    validateRazorpayConfig();

    // Initialize Notification Scheduler
    NotificationScheduler.initialize();

    app.listen(PORT, '0.0.0.0', () => {
      // console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup error:', error);
  }
}

startServer();
module.exports = app;
module.exports.handler = serverless(app);
