// Interfaz 1 · Portal del usuario (Encaja): todo lo del propio estudiante
const router = require('express').Router();
const { z } = require('zod');
const Carrera = require('../models/Carrera');
const Progreso = require('../models/Progreso');
const Cv = require('../models/Cv');
const Oferta = require('../models/Oferta');
const Usuario = require('../models/Usuario');
const { verificarJWT } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { calcularEncaje } = require('../services/encaje');
const { demanda, cruzarCv } = require('../services/competencias');

router.use(verificarJWT);

async function progresoDe(usuario) {
  if (!usuario.carrera) return { carrera: null, encaje: { pct: 0, lista: [] }, historial: [] };
  const carrera = await Carrera.findOne({ nombre: usuario.carrera }).lean();
  const progreso = await Progreso.findOne({ usuario: usuario._id, carrera: usuario.carrera }).lean();
  return { carrera, encaje: calcularEncaje(carrera, progreso), historial: (progreso?.historial || []).slice(-30).reverse() };
}

router.put('/carrera', validar(z.object({ carrera: z.string().min(2).max(80) })), async (req, res, next) => {
  try {
    if (!(await Carrera.exists({ nombre: req.validado.carrera }))) return res.status(404).json({ error: 'Esa carrera no existe.' });
    req.usuario.carrera = req.validado.carrera;
    await req.usuario.save();
    return res.json(await progresoDe(req.usuario));
  } catch (e) { return next(e); }
});

router.get('/progreso', async (req, res, next) => {
  try { return res.json(await progresoDe(req.usuario)); } catch (e) { return next(e); }
});

const pasoSchema = z.object({
  competencia: z.string().min(1).max(120),
  paso: z.number().int().min(0).max(2),
  completado: z.boolean(),
  enlace: z.string().url().max(300).optional().or(z.literal('')),
});
router.put('/progreso', validar(pasoSchema), async (req, res, next) => {
  try {
    const u = req.usuario;
    if (!u.carrera) return res.status(400).json({ error: 'Primero elige tu carrera.' });
    const { competencia, paso, completado, enlace } = req.validado;
    const carrera = await Carrera.findOne({ nombre: u.carrera }).lean();
    if (!carrera.competencias.some((c) => c.nombre === competencia)) return res.status(404).json({ error: 'Competencia no encontrada.' });
    const p = (await Progreso.findOne({ usuario: u._id, carrera: u.carrera })) || new Progreso({ usuario: u._id, carrera: u.carrera });
    let item = p.items.find((i) => i.competencia === competencia);
    if (!item) { p.items.push({ competencia }); item = p.items[p.items.length - 1]; }
    const pasos = [...item.pasos];
    pasos[paso] = completado;
    item.pasos = pasos;
    if (enlace !== undefined) item.enlace = enlace;
    if (completado) p.historial.push({ texto: `${competencia} · ${['Aprender', 'Practicar', 'Demostrar'][paso]}` });
    await p.save();
    return res.json(await progresoDe(u));
  } catch (e) { return next(e); }
});

// ---- CV (REQ-03: solo su dueño) ----
router.get('/cv', async (req, res, next) => {
  try { return res.json({ cv: await Cv.findOne({ usuario: req.usuario._id }).lean() }); } catch (e) { return next(e); }
});

router.get('/cv/:id', async (req, res, next) => {
  try {
    const cv = await Cv.findById(req.params.id).lean();
    if (!cv) return res.status(404).json({ error: 'CV no encontrado.' });
    if (String(cv.usuario) !== String(req.usuario._id)) return res.status(403).json({ error: 'Este CV no te pertenece.' });
    return res.json({ cv });
  } catch (e) { return next(e); }
});

const cvSchema = z.object({ texto: z.string().trim().min(20).max(60000), nombreArchivo: z.string().max(200).optional() });
router.put('/cv', validar(cvSchema), async (req, res, next) => {
  try {
    const cv = await Cv.findOneAndUpdate(
      { usuario: req.usuario._id },
      { texto: req.validado.texto, nombreArchivo: req.validado.nombreArchivo || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({ cv });
  } catch (e) { return next(e); }
});

router.delete('/cv', async (req, res, next) => {
  try { await Cv.deleteOne({ usuario: req.usuario._id }); return res.json({ ok: true }); } catch (e) { return next(e); }
});

// Cruce del CV con lo que piden hoy las empresas (ofertas extraídas por el scraper)
router.get('/analisis', async (req, res, next) => {
  try {
    const u = req.usuario;
    if (!u.carrera) return res.status(400).json({ error: 'Primero elige tu carrera.' });
    const cv = await Cv.findOne({ usuario: u._id }).lean();
    if (!cv) return res.status(404).json({ error: 'Sube tu CV para analizarlo.' });
    const carrera = await Carrera.findOne({ nombre: u.carrera }).lean();
    const ofertas = await Oferta.find({ carrera: u.carrera }).sort({ updatedAt: -1 }).limit(200).lean();
    const dem = demanda(ofertas, carrera);
    return res.json({ ...dem, ...cruzarCv(cv.texto, dem, carrera) });
  } catch (e) { return next(e); }
});

// Derecho a eliminar la cuenta (Ley 29733)
router.delete('/cuenta', async (req, res, next) => {
  try {
    const id = req.usuario._id;
    await Promise.all([Progreso.deleteMany({ usuario: id }), Cv.deleteMany({ usuario: id }), Usuario.deleteOne({ _id: id })]);
    return res.json({ ok: true });
  } catch (e) { return next(e); }
});

module.exports = router;
