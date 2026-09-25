// REQ-02: toda entrada se valida con un esquema; un objeto como {"$ne": null} donde se espera texto -> 400
const validar = (schema, origen = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[origen]);
  if (!r.success) {
    return res.status(400).json({ error: 'Datos inválidos.', detalle: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
  }
  req.validado = r.data;
  return next();
};

module.exports = { validar };
