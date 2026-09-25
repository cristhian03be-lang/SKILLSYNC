require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/encaja',
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'solo-desarrollo-cambiar'),
  jwtExpira: '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  scrapingCron: process.env.SCRAPING_CRON || '',
  maxIntentos: 5,        // REQ-01: intentos fallidos antes de bloquear
  bloqueoMinutos: 15,    // REQ-01: duración del bloqueo
};

// REQ-05: en producción los secretos solo pueden venir de variables de entorno
if (!config.jwtSecret) throw new Error('JWT_SECRET es obligatorio en producción (variable de entorno)');

module.exports = config;
