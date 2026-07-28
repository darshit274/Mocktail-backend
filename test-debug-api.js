const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const debugRoutes = require('./routes/debug');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Just add debug routes for testing
app.use('/api/debug', debugRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Debug API Test Server',
    available_endpoints: [
      'GET /api/debug/tables - Check database table contents',
      'GET /api/debug/user/:userId - Check specific user data',
      'GET /api/debug/raw-query/:table - Execute raw table queries'
    ]
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  // console.log(`🧪 Debug API test server running on http://localhost:${PORT}`);
  // console.log('📊 Available debug endpoints:');
  // console.log(`   GET http://localhost:${PORT}/api/debug/tables`);
  // console.log(`   GET http://localhost:${PORT}/api/debug/user/:userId`);
  // console.log(`   GET http://localhost:${PORT}/api/debug/raw-query/:table`);
});

module.exports = app;