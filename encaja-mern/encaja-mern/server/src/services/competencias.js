// Detección de competencias en texto libre (ofertas y CV) por palabras clave.
const STOP = new Set(['y', 'de', 'del', 'la', 'el', 'en', 'para', 'con', 'por', 'los', 'las', 'un', 'una', 'o',
  'basico', 'basica', 'intermedio', 'avanzado', 'tecnico', 'tecnica', 'general', 'practica', 'gestion']);

// Competencias transversales que piden las empresas aunque no estén en el catálogo
const TRANSVERSALES = {
  Excel: ['excel'], 'Power BI': ['power bi', 'powerbi'], SQL: ['sql', 'mysql', 'postgres'], Python: ['python'],
  Inglés: ['ingles', 'english', 'bilingue'], SAP: ['sap'], AWS: ['aws'], Azure: ['azure'], Linux: ['linux'],
  Redes: ['redes', 'networking', 'tcp/ip', 'cisco', 'ccna'], SIEM: ['siem', 'splunk', 'wazuh', 'qradar', 'sentinel'],
  'ISO 27001': ['iso 27001', 'iso27001'], Pentesting: ['pentest', 'ethical hacking', 'owasp', 'burp', 'nmap'],
  'Scrum / Agile': ['scrum', 'agile', 'jira'], Git: ['git', 'github', 'gitlab'],
  'JavaScript / React': ['javascript', 'react', 'angular', 'node'], AutoCAD: ['autocad'], 'Revit / BIM': ['revit', 'bim'],
  Figma: ['figma'], Canva: ['canva'], 'Atención al cliente': ['atencion al cliente', 'servicio al cliente'],
  'Trabajo en equipo': ['trabajo en equipo'], Liderazgo: ['liderazgo'], 'Ventas / negociación': ['ventas', 'negociacion'],
  'Contabilidad / SUNAT': ['sunat', 'pcge', 'concar', 'contabilidad'], 'Power Platform': ['power automate', 'power apps'],
};

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Coincidencia con límite de palabra para claves cortas (evita que "git" coincida con "digital")
function incluye(texto, clave) {
  const v = (clave || '').trim();
  if (!v) return false;
  if (v.length >= 6) return texto.includes(v);
  return new RegExp(`(^|[^a-z0-9+#])${escapar(v)}([^a-z0-9]|$)`).test(texto);
}

function claves(nombre) {
  return norm(nombre).split(/[\s/,·()]+/).filter((k) => k.length >= 3 && !STOP.has(k));
}

function variantesDe(nombre) {
  const base = claves(nombre);
  const extra = [];
  Object.values(TRANSVERSALES).forEach((vs) => {
    const v = vs.map(norm);
    if (v.some((x) => base.includes(x))) extra.push(...v);
  });
  return [...new Set([...base, ...extra])];
}

/** Competencias del catálogo de la carrera (y transversales) que aparecen en un texto. */
function detectar(texto, carrera) {
  const t = norm(texto);
  const encontradas = [];
  const vistas = new Set();
  (carrera?.competencias || []).forEach((c) => {
    const vs = variantesDe(c.nombre);
    vs.forEach((v) => vistas.add(v));
    if (vs.some((v) => incluye(t, v))) encontradas.push(c.nombre);
  });
  Object.entries(TRANSVERSALES).forEach(([nombre, vs]) => {
    const v = vs.map(norm);
    if (v.some((x) => vistas.has(x))) return;
    if (v.some((x) => incluye(t, x))) encontradas.push(nombre);
  });
  return encontradas;
}

/** % de ofertas que piden cada competencia. Si no hay ofertas, usa el peso del catálogo. */
function demanda(ofertas, carrera) {
  const total = ofertas.length;
  const cuenta = {};
  ofertas.forEach((o) => (o.competencias || []).forEach((c) => { cuenta[c] = (cuenta[c] || 0) + 1; }));
  const enCatalogo = new Set((carrera?.competencias || []).map((c) => c.nombre));
  const lista = (carrera?.competencias || []).map((c) => ({
    nombre: c.nombre,
    pct: total ? Math.round((100 * (cuenta[c.nombre] || 0)) / total) : c.peso,
    enCatalogo: true,
    recurso: c.recurso,
  }));
  if (total) {
    Object.entries(cuenta).forEach(([nombre, n]) => {
      if (!enCatalogo.has(nombre) && (100 * n) / total >= 10) {
        lista.push({ nombre, pct: Math.round((100 * n) / total), enCatalogo: false, recurso: '' });
      }
    });
  }
  return { totalOfertas: total, enVivo: total > 0, competencias: lista.sort((a, b) => b.pct - a.pct) };
}

/** Cruza un CV con la demanda: qué tiene, qué le falta y cobertura ponderada. */
function cruzarCv(textoCv, dem, carrera) {
  const tiene = new Set(detectar(textoCv, carrera));
  const tienes = dem.competencias.filter((c) => tiene.has(c.nombre));
  const faltan = dem.competencias.filter((c) => !tiene.has(c.nombre));
  const peso = dem.competencias.reduce((s, c) => s + c.pct, 0) || 1;
  const cobertura = Math.round((100 * tienes.reduce((s, c) => s + c.pct, 0)) / peso);
  return { cobertura, tienes, faltan };
}

module.exports = { norm, incluye, claves, variantesDe, detectar, demanda, cruzarCv, TRANSVERSALES };
