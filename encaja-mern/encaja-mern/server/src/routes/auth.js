const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const config = require('../config');
const Usuario = require('../models/Usuario');
const Auditoria = require('../models/Auditoria');
const { firmar, verificarJWT } = require('../middleware/auth');
const { validar } = require('../middleware/validar');

const limitador = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false });
router.use(limitador);

const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(100),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) });

router.post('/registro', validar(registroSchema), async (req, res, next) => {
  try {
    const { nombre, email, password } = req.validado;
    if (await Usuario.exists({ email })) return res.status(409).json({ error: 'Ese correo ya está registrado.' });
    const usuario = await Usuario.create({ nombre, email, passwordHash: await bcrypt.hash(password, 12) });
    await Auditoria.create({ usuario: usuario._id, email, accion: 'registro', ip: req.ip });
    return res.status(201).json({ token: firmar(usuario), usuario: usuario.publico() });
  } catch (e) { return next(e); }
});

// REQ-01: 5 intentos fallidos -> cuenta bloqueada 15 minutos (423), aunque luego la contraseña sea correcta
router.post('/login', validar(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validado;
    const usuario = await Usuario.findOne({ email }).select('+passwordHash +intentosFallidos +bloqueadoHasta');
    const generico = { error: 'Correo o contraseña incorrectos.' };
    if (!usuario) return res.status(401).json(generico);

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const min = Math.ceil((usuario.bloqueadoHasta - Date.now()) / 60000);
      return res.status(423).json({ error: `Cuenta bloqueada por intentos fallidos. Intenta en ${min} min.` });
    }

    const ok = await bcrypt.compare(password, usuario.passwordHash);
    if (!ok) {
      usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;
      if (usuario.intentosFallidos >= config.maxIntentos) {
        usuario.bloqueadoHasta = new Date(Date.now() + config.bloqueoMinutos * 60000);
        usuario.intentosFallidos = 0;
        await usuario.save();
        await Auditoria.create({ usuario: usuario._id, email, accion: 'cuenta_bloqueada', ip: req.ip });
        return res.status(423).json({ error: `Cuenta bloqueada ${config.bloqueoMinutos} minutos por intentos fallidos.` });
      }
      await usuario.save();
      await Auditoria.create({ usuario: usuario._id, email, accion: 'login_fallido', ip: req.ip });
      return res.status(401).json(generico);
    }

    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    usuario.ultimoAcceso = new Date();
    await usuario.save();
    await Auditoria.create({ usuario: usuario._id, email, accion: 'login_ok', ip: req.ip });
    return res.json({ token: firmar(usuario), usuario: usuario.publico() });
  } catch (e) { return next(e); }
});

router.get('/me', verificarJWT, (req, res) => res.json({ usuario: req.usuario.publico() }));

module.exports = router;
