// Uso: npm run scrape            -> todas las carreras
//      npm run scrape -- "Marketing"
const mongoose = require('mongoose');
const config = require('../../config');
const Carrera = require('../../models/Carrera');
const ScrapingJob = require('../../models/ScrapingJob');
const { ejecutarJob, scrapearTodo } = require('./runner');

(async () => {
  await mongoose.connect(config.mongoUri);
  const nombre = process.argv[2];
  if (nombre) {
    const c = await Carrera.findOne({ nombre });
    if (!c) throw new Error(`No existe la carrera ${nombre}`);
    const job = await ScrapingJob.create({ carrera: c.nombre, puesto: c.puesto });
    const r = await ejecutarJob(job._id);
    console.log(r.estado, r.resultados);
  } else {
    await scrapearTodo();
    console.log('Scraping completo');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
