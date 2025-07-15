const { app, sequelize } = require('../index');

let isDbConnected = false;

module.exports = async (req, res) => {
  if (!isDbConnected) {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connected (Vercel handler).');
      isDbConnected = true;
    } catch (error) {
      console.error('❌ DB Connection error (Vercel handler):', error);
      res.status(500).send('Database connection error');
      return;
    }
  }
  app(req, res);
};
