require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "MockTale",
    host: process.env.DB_HOST || "localhost",
    dialect: process.env.DB_DIALECT || "mysql",
    port: process.env.DB_PORT || 3306,
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      connectTimeout: 20000,
      ssl: {
        require: false, 
        rejectUnauthorized: false,
      },
    },
  },

  test: {
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "MockTale_test",
    host: process.env.DB_HOST || "localhost",
    dialect: process.env.DB_DIALECT || "mysql",
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 20000,
      idle: 5000,
    },
    dialectOptions: {
      ssl: {
        require: false,
        rejectUnauthorized: false,
      },
    },
  },

  production: {
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "MockTale",
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT || "mysql",
    port: process.env.DB_PORT || 3306,
    logging: false,
    pool: {
      max: 15,    
      min: 5,     
      acquire: 60000,
      idle: 30000,
    },
    dialectOptions: {
      connectTimeout: 30000,
      ssl: {
        require: true,           
        rejectUnauthorized: true 
      },
    },
  },
};
