// Interfaz 3 · Panel de scraping (solo rol admin)
const router = require('express').Router();
const { z } = require('zod');
const Carrera = require('../models/Carrera');
const Oferta = require('../models/Oferta');
const ScrapingJob = require('../models/ScrapingJob');
const Auditoria = require('../models/Auditoria');
const { verificarJWT, requireRole } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { ejecutarJob } = require('../services/scraper/runner');
const { FUENTES } = require('../services/scraper/fuentes');

router.use(verificarJWT, requireRole('admin'));

router.get('/fuentes', (req, res) => res.json(Object.keys(FUENTES)));

const jobSchema = z.object({
  carrera: z.string().min(2).max(80),
  puesto: z.string().min(2).max(120).optional(),
  fuentes: z.array(z.enum(Object.keys(FUENTES))).min(1).default(Object.keys(FUENTES)),
});

router.post('/jobs', validar(jobSchema), async (req, res, next) => {
  try {
    const carrera = await Carrera.findOne({ nombre: req.validado.carrera }).lean();
    if (!carrera) return res.status(404).json({ error: 'Esa carrera no existe.' });
    const job = await ScrapingJob.create({ carrera: carrera.nombre, puesto: req.validado.puesto || carrera.puesto,
      fuentes: req.validado.fuentes, iniciadoPor: req.usuario._id });
    await Auditoria.create({ usuario: req.usuario._id, email: req.usuario.email, accion: 'scraping_lanzado', detalle: `${carrera.nombre} (${job.puesto})`, ip: req.ip });
    if (process.env.NODE_ENV !== 'test') setImmediate(() => ejecutarJob(job._id).catch(() => {}));
    return res.status(202).json(job);
  } catch (e) { return next(e); }
});

router.get('/jobs', async (req, res, next) => {
  try { return res.json(await ScrapingJob.find().sort({ createdAt: -1 }).limit(30).lean()); } catch (e) { return next(e); }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await ScrapingJob.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Job no encontrado.' });
    return res.json(job);
  } catch (e) { return next(e); }
});

router.get('/ofertas', async (req, res, next) => {
  try {
    const filtro = req.query.carrera ? { carrera: String(req.query.carrera) } : {};
    return res.json(await Oferta.find(filtro).sort({ updatedAt: -1 }).limit(100).lean());
  } catch (e) { return next(e); }
});

router.delete('/ofertas/:id', async (req, res, next) => {
  try { await Oferta.deleteOne({ _id: req.params.id }); return res.json({ ok: true }); } catch (e) { return next(e); }
});

module.exports = router;
