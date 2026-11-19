const path = require('path');
const { execFileSync } = require('child_process');
const mongoose = require('mongoose');
const cron = require('node-cron');
const config = require('./config');
const app = require('./app');
const { scrapearTodo } = require('./services/scraper/runner');

// Sin MONGO_URI (MONGO_EMBEBIDO=true), la API levanta su propio MongoDB dentro del servidor.
// Sirve para la demo en Render sin cuentas externas; los datos se reinician cuando el servidor se reinicia.
async function prepararBaseDeDatos() {
  if (process.env.MONGO_EMBEBIDO !== 'true') return;
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongo = await MongoMemoryServer.create({
    instance: { dbName: 'encaja', args: ['--wiredTigerCacheSizeGB', '0.25'] },
  });
  config.mongoUri = mongo.getUri('encaja');
  process.env.MONGO_URI = config.mongoUri;
  console.log('MongoDB embebido iniciado');
  // Carga carreras, administrador y ofertas de muestra (el seed es idempotente)
  execFileSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit', env: process.env });
}

(async () => {
  await prepararBaseDeDatos();
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB conectado');
  if (config.scrapingCron && cron.validate(config.scrapingCron)) {
    cron.schedule(config.scrapingCron, () => scrapearTodo().catch((e) => console.error('Scraping programado falló:', e.message)));
    console.log(`Scraping programado: ${config.scrapingCron}`);
  }
  app.listen(config.port, () => console.log(`API de Encaja en http://localhost:${config.port}`));
})().catch((e) => { console.error(e); process.exit(1); });
