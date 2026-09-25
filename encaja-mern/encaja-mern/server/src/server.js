const mongoose = require('mongoose');
const cron = require('node-cron');
const config = require('./config');
const app = require('./app');
const { scrapearTodo } = require('./services/scraper/runner');

(async () => {
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB conectado');
  if (config.scrapingCron && cron.validate(config.scrapingCron)) {
    cron.schedule(config.scrapingCron, () => scrapearTodo().catch((e) => console.error('Scraping programado falló:', e.message)));
    console.log(`Scraping programado: ${config.scrapingCron}`);
  }
  app.listen(config.port, () => console.log(`API de Encaja en http://localhost:${config.port}`));
})().catch((e) => { console.error(e); process.exit(1); });
