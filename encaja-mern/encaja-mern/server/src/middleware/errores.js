// Nunca se devuelven trazas internas al cliente
// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
  if (err.name === 'CastError') return res.status(400).json({ error: 'Identificador inválido.' });
  if (err.code === 11000) return res.status(409).json({ error: 'Ese registro ya existe.' });
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = { manejarErrores };
