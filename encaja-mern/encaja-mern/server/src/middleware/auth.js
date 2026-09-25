const jwt = require('jsonwebtoken');
const config = require('../config');
const Usuario = require('../models/Usuario');

const firmar = (usuario) => jwt.sign({ sub: String(usuario._id), rol: usuario.rol }, config.jwtSecret, { expiresIn: config.jwtExpira });

/** REQ-03: sin token válido y vigente -> 401. El rol se lee de la base, no del token. */
async function verificarJWT(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    const payload = jwt.verify(h.slice(7), config.jwtSecret);
    const usuario = await Usuario.findById(payload.sub);
    if (!usuario) return res.status(401).json({ error: 'Usuario no encontrado.' });
    req.usuario = usuario;
    return next();
  } catch {
    return res.status(401).json({ error: 'Tu sesión venció. Vuelve a iniciar sesión.' });
  }
}

/** REQ-04: solo los roles permitidos pasan; el resto recibe 403. */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.usuario || !roles.includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
  }
  return next();
};

module.exports = { firmar, verificarJWT, requireRole };
