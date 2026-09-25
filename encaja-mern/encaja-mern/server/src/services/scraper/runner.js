const Carrera = require('../../models/Carrera');
const Oferta = require('../../models/Oferta');
const ScrapingJob = require('../../models/ScrapingJob');
const { buscar: buscarReal } = require('./fuentes');
const { detectar } = require('../competencias');

/** Ejecuta un job de scraping: descarga, limpia, detecta competencias y guarda ofertas nuevas. */
async function ejecutarJob(jobId, { buscar = buscarReal } = {}) {
  const job = await ScrapingJob.findById(jobId);
  if (!job) return null;
  job.estado = 'ejecutando';
  job.inicio = new Date();
  await job.save();
  try {
    const carrera = await Carrera.findOne({ nombre: job.carrera }).lean();
    if (!carrera) throw new Error('La carrera ya no existe');
    let total = 0; let nuevas = 0;
    for (const fuente of job.fuentes) {
      try {
        const ofertas = (await buscar(fuente, job.puesto, 'Lima')).slice(0, 40);
        for (const o of ofertas) {
          if (!o.url) continue;
          const competencias = detectar(`${o.titulo} ${o.resumen}`, carrera);
          const r = await Oferta.updateOne(
            { url: o.url },
            { $set: { ...o, carrera: carrera.nombre, puesto: job.puesto, competencias, job: job._id } },
            { upsert: true },
          );
          if (r.upsertedCount) nuevas += 1;
        }
        total += ofertas.length;
        job.resultados.push({ fuente, encontradas: ofertas.length, error: '' });
      } catch (e) {
        job.resultados.push({ fuente, encontradas: 0, error: e.message.slice(0, 200) });
      }
    }
    job.totalOfertas = total;
    job.nuevas = nuevas;
    job.estado = job.resultados.every((r) => r.error) ? 'error' : 'completado';
    if (job.estado === 'error') job.error = 'Ninguna fuente respondió';
  } catch (e) {
    job.estado = 'error';
    job.error = e.message;
  }
  job.fin = new Date();
  await job.save();
  return job;
}

/** Programa un job por cada carrera (usado por el cron). */
async function scrapearTodo() {
  const carreras = await Carrera.find().lean();
  for (const c of carreras) {
    const job = await ScrapingJob.create({ carrera: c.nombre, puesto: c.puesto, programado: true });
    await ejecutarJob(job._id);
  }
}

module.exports = { ejecutarJob, scrapearTodo };
