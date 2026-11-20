const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'urbanlink_flow',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    timezone: '-03:00',
    pool: { max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 2 : 5)), min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {},
    define: { underscored: true, freezeTableName: true }
  }
);

module.exports = sequelize;
