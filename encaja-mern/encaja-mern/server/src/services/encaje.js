/** Porcentaje "listo para entrar": cada competencia pesa según su demanda y cada paso vale 1/3. */
function calcularEncaje(carrera, progreso) {
  if (!carrera) return { pct: 0, lista: [] };
  const items = new Map((progreso?.items || []).map((i) => [i.competencia, i]));
  const total = carrera.competencias.reduce((s, c) => s + c.peso, 0) || 1;
  let logrado = 0;
  const lista = carrera.competencias.map((c) => {
    const it = items.get(c.nombre);
    const pasos = it?.pasos?.length === 3 ? it.pasos : [false, false, false];
    const hechos = pasos.filter(Boolean).length;
    logrado += (c.peso * hechos) / 3;
    return { nombre: c.nombre, peso: c.peso, recurso: c.recurso, video: c.video, pasos, hechos, enlace: it?.enlace || '' };
  }).sort((a, b) => (a.hechos === 3) - (b.hechos === 3) || b.peso - a.peso);
  return { pct: Math.round((100 * logrado) / total), lista };
}

module.exports = { calcularEncaje };
