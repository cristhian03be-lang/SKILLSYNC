// Interfaz 2 · Panel administrativo: CRUD del catálogo, usuarios y dashboard de métricas (solo rol admin)
const router = require('express').Router();
const { z } = require('zod');
const Carrera = require('../models/Carrera');
const Usuario = require('../models/Usuario');
const Progreso = require('../models/Progreso');
const Cv = require('../models/Cv');
const Oferta = require('../models/Oferta');
const ScrapingJob = require('../models/ScrapingJob');
const Auditoria = require('../models/Auditoria');
const { verificarJWT, requireRole } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { calcularEncaje } = require('../services/encaje');

router.use(verificarJWT, requireRole('admin'));

const auditar = (req, accion, detalle) => Auditoria.create({ usuario: req.usuario._id, email: req.usuario.email, accion, detalle, ip: req.ip });

const competenciaSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  peso: z.number().int().min(1).max(100),
  recurso: z.string().max(300).default(''),
  video: z.string().url().max(300).optional().or(z.literal('')),
});
const carreraSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  puesto: z.string().trim().min(2).max(120),
  icono: z.string().max(8).default('🎓'),
  competencias: z.array(competenciaSchema).min(1).max(30),
});

router.post('/carreras', validar(carreraSchema), async (req, res, next) => {
  try {
    const c = await Carrera.create(req.validado);
    await auditar(req, 'admin_crear_carrera', c.nombre);
    return res.status(201).json(c);
  } catch (e) { return next(e); }
});

router.put('/carreras/:id', validar(carreraSchema), async (req, res, next) => {
  try {
    const anterior = await Carrera.findById(req.params.id);
    if (!anterior) return res.status(404).json({ error: 'Carrera no encontrada.' });
    const nombreAnterior = anterior.nombre;
    Object.assign(anterior, req.validado);
    await anterior.save();
    if (nombreAnterior !== anterior.nombre) {
      await Promise.all([
        Usuario.updateMany({ carrera: nombreAnterior }, { carrera: anterior.nombre }),
        Progreso.updateMany({ carrera: nombreAnterior }, { carrera: anterior.nombre }),
        Oferta.updateMany({ carrera: nombreAnterior }, { carrera: anterior.nombre }),
      ]);
    }
    await auditar(req, 'admin_editar_carrera', anterior.nombre);
    return res.json(anterior);
  } catch (e) { return next(e); }
});

router.delete('/carreras/:id', async (req, res, next) => {
  try {
    const c = await Carrera.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ error: 'Carrera no encontrada.' });
    await auditar(req, 'admin_eliminar_carrera', c.nombre);
    return res.json({ ok: true });
  } catch (e) { return next(e); }
});

router.get('/usuarios', async (req, res, next) => {
  try {
    const [usuarios, carreras, progresos, cvs] = await Promise.all([
      Usuario.find().sort({ createdAt: -1 }).lean(), Carrera.find().lean(), Progreso.find().lean(), Cv.find().select('usuario').lean(),
    ]);
    const porNombre = new Map(carreras.map((c) => [c.nombre, c]));
    const conCv = new Set(cvs.map((c) => String(c.usuario)));
    return res.json(usuarios.map((u) => {
      const p = progresos.find((x) => String(x.usuario) === String(u._id) && x.carrera === u.carrera);
      return { id: u._id, nombre: u.nombre, email: u.email, rol: u.rol, carrera: u.carrera, creado: u.createdAt,
        ultimoAcceso: u.ultimoAcceso, encaje: calcularEncaje(porNombre.get(u.carrera), p).pct, tieneCv: conCv.has(String(u._id)) };
    }));
  } catch (e) { return next(e); }
});

router.patch('/usuarios/:id/rol', validar(z.object({ rol: z.enum(['estudiante', 'admin']) })), async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.usuario._id)) return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
    const u = await Usuario.findByIdAndUpdate(req.params.id, { rol: req.validado.rol }, { new: true });
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
    await auditar(req, 'admin_cambiar_rol', `${u.email} -> ${u.rol}`);
    return res.json(u.publico());
  } catch (e) { return next(e); }
});

router.delete('/usuarios/:id', async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.usuario._id)) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde aquí.' });
    const u = await Usuario.findByIdAndDelete(req.params.id);
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
    await Promise.all([Progreso.deleteMany({ usuario: u._id }), Cv.deleteMany({ usuario: u._id })]);
    await auditar(req, 'admin_eliminar_usuario', u.email);
    return res.json({ ok: true });
  } catch (e) { return next(e); }
});

// Dashboard de métricas
router.get('/metricas', async (req, res, next) => {
  try {
    const hace7 = new Date(Date.now() - 7 * 864e5);
    const [usuarios, carreras, progresos, totalCv, ofertas, jobs, logins, fallidos, bloqueos] = await Promise.all([
      Usuario.find({ rol: 'estudiante' }).lean(), Carrera.find().lean(), Progreso.find().lean(), Cv.countDocuments(),
      Oferta.find().select('fuente competencias carrera').lean(), ScrapingJob.find().sort({ createdAt: -1 }).limit(5).lean(),
      Auditoria.countDocuments({ accion: 'login_ok', createdAt: { $gte: hace7 } }),
      Auditoria.countDocuments({ accion: 'login_fallido', createdAt: { $gte: hace7 } }),
      Auditoria.countDocuments({ accion: 'cuenta_bloqueada', createdAt: { $gte: hace7 } }),
    ]);
    const porNombre = new Map(carreras.map((c) => [c.nombre, c]));
    const encajes = usuarios.filter((u) => u.carrera).map((u) => calcularEncaje(porNombre.get(u.carrera),
      progresos.find((p) => String(p.usuario) === String(u._id) && p.carrera === u.carrera)).pct);
    const contar = (arr) => Object.entries(arr.reduce((m, k) => ({ ...m, [k]: (m[k] || 0) + 1 }), {}))
      .map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n);
    return res.json({
      totales: { estudiantes: usuarios.length, conCarrera: encajes.length, conCv: totalCv, ofertas: ofertas.length, carreras: carreras.length },
      encajePromedio: encajes.length ? Math.round(encajes.reduce((s, x) => s + x, 0) / encajes.length) : 0,
      carrerasMasElegidas: contar(usuarios.filter((u) => u.carrera).map((u) => u.carrera)).slice(0, 8),
      competenciasMasPedidas: contar(ofertas.flatMap((o) => o.competencias)).slice(0, 10),
      ofertasPorFuente: contar(ofertas.map((o) => o.fuente)),
      seguridad7dias: { loginsOk: logins, loginsFallidos: fallidos, bloqueos },
      ultimosJobs: jobs,
    });
  } catch (e) { return next(e); }
});

router.get('/auditoria', async (req, res, next) => {
  try { return res.json(await Auditoria.find().sort({ createdAt: -1 }).limit(100).lean()); } catch (e) { return next(e); }
});

module.exports = router;
