const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = process.env.NODE_ENV || 'development';
const isTest = env === 'test';
const isProd = env === 'production';

const jwtSecret = process.env.JWT_SECRET || '';
if (jwtSecret.length < (isProd ? 32 : 16)) {
  throw new Error('JWT_SECRET no está definido o es demasiado corto (revisa el archivo .env)');
}

module.exports = {
  env,
  isTest,
  isProd,
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: isTest ? process.env.DB_NAME_TEST : process.env.DB_NAME,
    logging: process.env.DB_LOGGING === 'true',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((o) => o.trim()),
  bcryptRounds: isTest ? 4 : 10,
};
