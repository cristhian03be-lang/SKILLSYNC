const router = require('express').Router();
const Carrera = require('../models/Carrera');
const Oferta = require('../models/Oferta');
const { demanda } = require('../services/competencias');

router.get('/carreras', async (req, res, next) => {
  try { return res.json(await Carrera.find().sort({ nombre: 1 }).lean()); } catch (e) { return next(e); }
});

router.get('/ofertas', async (req, res, next) => {
  try {
    const carrera = String(req.query.carrera || '');
    const ofertas = await Oferta.find({ carrera }).sort({ updatedAt: -1 }).limit(30)
      .select('titulo empresa lugar resumen url fuente publicada updatedAt competencias').lean();
    return res.json(ofertas);
  } catch (e) { return next(e); }
});

router.get('/demanda', async (req, res, next) => {
  try {
    const carrera = await Carrera.findOne({ nombre: String(req.query.carrera || '') }).lean();
    if (!carrera) return res.status(404).json({ error: 'Esa carrera no existe.' });
    const ofertas = await Oferta.find({ carrera: carrera.nombre }).select('competencias').lean();
    return res.json(demanda(ofertas, carrera));
  } catch (e) { return next(e); }
});

module.exports = router;
