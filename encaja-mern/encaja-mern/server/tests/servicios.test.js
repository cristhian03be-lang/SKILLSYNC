// Pruebas unitarias de servicios y middlewares que no pasan por HTTP:
// cálculo de encaje, detección de competencias, utilidades del scraper, manejo de errores, roles y configuración.
const { calcularEncaje } = require('../src/services/encaje');
const { incluye, claves, variantesDe, detectar, demanda, cruzarCv } = require('../src/services/competencias');
const { limpiar, slug, absoluta } = require('../src/services/scraper/util');
const { parseJooble, parseComputrabajo, parseBumeran, FUENTES } = require('../src/services/scraper/fuentes');
const { manejarErrores } = require('../src/middleware/errores');
const { requireRole } = require('../src/middleware/auth');
const carreras = require('../src/data/carreras.json');

const cyber = carreras.find((c) => c.nombre === 'Ingeniería de Ciberseguridad');

const resFalso = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('calcularEncaje', () => {
  const carrera = { competencias: [{ nombre: 'A', peso: 60, recurso: 'r', video: 'v' }, { nombre: 'B', peso: 40 }] };

  test('sin carrera el encaje es 0', () => {
    expect(calcularEncaje(null)).toEqual({ pct: 0, lista: [] });
  });

  test('sin progreso todo está en 0 y ordena por peso', () => {
    const r = calcularEncaje(carrera, null);
    expect(r.pct).toBe(0);
    expect(r.lista.map((c) => c.nombre)).toEqual(['A', 'B']);
    expect(r.lista[0]).toMatchObject({ pasos: [false, false, false], hechos: 0, enlace: '' });
  });

  test('cada paso vale un tercio del peso y las completas van al final', () => {
    const r = calcularEncaje(carrera, { items: [
      { competencia: 'A', pasos: [true, true, true], enlace: 'https://github.com/x' },
      { competencia: 'B', pasos: [true] }, // pasos mal formados se ignoran
    ] });
    expect(r.pct).toBe(60);
    expect(r.lista.map((c) => c.nombre)).toEqual(['B', 'A']);
    expect(r.lista[1].enlace).toBe('https://github.com/x');
  });

  test('una carrera sin competencias no divide entre cero', () => {
    expect(calcularEncaje({ competencias: [] }, null)).toEqual({ pct: 0, lista: [] });
  });
});

describe('competencias (casos borde)', () => {
  test('incluye: clave vacía es falso y claves largas usan búsqueda simple', () => {
    expect(incluye('texto', '')).toBe(false);
    expect(incluye('texto', undefined)).toBe(false);
    expect(incluye('experto en contabilidad', 'contabilidad')).toBe(true);
  });

  test('claves descarta palabras vacías y cortas', () => {
    expect(claves('Gestión de redes y TCP/IP')).toEqual(['redes', 'tcp']);
  });

  test('variantesDe agrega sinónimos transversales', () => {
    expect(variantesDe('SIEM (Splunk / Wazuh)')).toEqual(expect.arrayContaining(['siem', 'qradar', 'sentinel']));
  });

  test('detectar sin carrera usa solo competencias transversales', () => {
    expect(detectar('Excel avanzado y SQL', undefined)).toEqual(['Excel', 'SQL']);
    expect(detectar(null, null)).toEqual([]);
  });

  test('demanda sin ofertas usa el peso del catálogo', () => {
    const d = demanda([], cyber);
    expect(d).toMatchObject({ totalOfertas: 0, enVivo: false });
    expect(d.competencias[0].pct).toBe(Math.max(...cyber.competencias.map((c) => c.peso)));
    expect(demanda([], null).competencias).toEqual([]);
  });

  test('demanda agrega competencias fuera del catálogo solo si superan el 10 %', () => {
    const ofertas = [
      { competencias: ['Excel'] }, { competencias: ['Excel'] }, { competencias: [] }, { },
      ...Array.from({ length: 7 }, () => ({ competencias: ['Redes y TCP/IP'] })),
      ...Array.from({ length: 8 }, () => ({ competencias: [] })),
      { competencias: ['Canva'] },
    ];
    expect(ofertas).toHaveLength(20);
    const nombres = demanda(ofertas, cyber).competencias.map((c) => c.nombre);
    expect(nombres).toContain('Excel'); // 2/20 = 10 %
    expect(nombres).not.toContain('Canva'); // 1/20 = 5 %
  });

  test('cruzarCv sin demanda no divide entre cero', () => {
    expect(cruzarCv('cualquier cosa', { competencias: [] }, null)).toEqual({ cobertura: 0, tienes: [], faltan: [] });
  });
});

describe('utilidades del scraper', () => {
  test('limpiar convierte cualquier cosa en texto plano', () => {
    expect(limpiar(null)).toBe('');
    expect(limpiar('<b>Hola</b>   &amp;  <img src=x onerror=alert(1)>mundo')).toBe('Hola & mundo');
  });

  test('slug quita tildes y símbolos', () => {
    expect(slug('Analista SOC (Junior) – Ñandú')).toBe('analista-soc-junior-nandu');
  });

  test('absoluta resuelve rutas relativas y descarta las inválidas', () => {
    expect(absoluta('/jdp/1', 'https://pe.jooble.org')).toBe('https://pe.jooble.org/jdp/1');
    expect(absoluta('', 'https://x.pe')).toBe('');
    expect(absoluta('http://[::1', 'https://x.pe')).toBe('');
  });

  test('cada portal arma su URL de búsqueda', () => {
    expect(FUENTES.Jooble.url('Analista SOC', 'Lima')).toBe('https://pe.jooble.org/trabajo-analista-soc/Lima%2C%20Lima');
    expect(FUENTES.Computrabajo.url('Analista SOC', 'Lima')).toBe('https://pe.computrabajo.com/trabajo-de-analista-soc-en-lima');
    expect(FUENTES.Bumeran.url('Analista SOC', 'Lima')).toBe('https://www.bumeran.com.pe/en-lima/empleos-busqueda-analista-soc.html');
  });

  test('parsers: ignoran enlaces sin título y usan el contenedor cercano', () => {
    const jooble = parseJooble('<div><div><a href="/jdp/9">Analista de datos</a></div></div><a href="/jdp/1">ab</a>');
    expect(jooble).toHaveLength(1);
    expect(jooble[0]).toMatchObject({ titulo: 'Analista de datos', url: 'https://pe.jooble.org/jdp/9' });
    expect(parseComputrabajo('<article><p>sin título</p></article>')).toEqual([]);
    const bumeran = parseBumeran('<a href="/empleos/x.html">Soporte TI nivel 1</a><a href="/empleos/y.html">TI</a>');
    expect(bumeran).toHaveLength(1);
    expect(bumeran[0].titulo).toBe('Soporte TI nivel 1');
  });
});

describe('middlewares', () => {
  test('requireRole responde 403 si no hay usuario y deja pasar al rol correcto', () => {
    const res = resFalso();
    const next = jest.fn();
    requireRole('admin')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    requireRole('admin')({ usuario: { rol: 'admin' } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('manejarErrores traduce errores conocidos y oculta el resto', () => {
    const res = resFalso();
    manejarErrores({ name: 'CastError' }, {}, res);
    expect(res.status).toHaveBeenLastCalledWith(400);
    manejarErrores({ code: 11000 }, {}, res);
    expect(res.status).toHaveBeenLastCalledWith(409);
  });

  test('fuera de test el error se registra en consola pero no se envía al cliente', () => {
    const anterior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = resFalso();
      manejarErrores(new Error('secreto interno'), {}, res);
      expect(log).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor.' });
    } finally {
      process.env.NODE_ENV = anterior;
      log.mockRestore();
    }
  });
});

describe('configuración (REQ-05: secretos solo desde variables de entorno)', () => {
  const VARS = ['NODE_ENV', 'PORT', 'MONGO_URI', 'JWT_SECRET', 'CLIENT_ORIGIN', 'SCRAPING_CRON'];
  let copia;
  beforeEach(() => { copia = Object.fromEntries(VARS.map((k) => [k, process.env[k]])); VARS.forEach((k) => delete process.env[k]); });
  afterEach(() => VARS.forEach((k) => { if (copia[k] === undefined) delete process.env[k]; else process.env[k] = copia[k]; }));
  const cargar = () => { let c; jest.isolateModules(() => { c = require('../src/config'); }); return c; };

  test('valores por defecto en desarrollo', () => {
    expect(cargar()).toMatchObject({ env: 'development', port: 4000, mongoUri: 'mongodb://127.0.0.1:27017/encaja',
      jwtSecret: 'solo-desarrollo-cambiar', clientOrigin: 'http://localhost:5173', scrapingCron: '' });
  });

  test('usa las variables de entorno cuando existen', () => {
    Object.assign(process.env, { NODE_ENV: 'production', PORT: '8080', MONGO_URI: 'mongodb://db/encaja', JWT_SECRET: 'x'.repeat(32),
      CLIENT_ORIGIN: 'https://encaja.vercel.app', SCRAPING_CRON: '0 6 * * *' });
    expect(cargar()).toMatchObject({ env: 'production', port: 8080, mongoUri: 'mongodb://db/encaja', clientOrigin: 'https://encaja.vercel.app', scrapingCron: '0 6 * * *' });
  });

  test('en producción sin JWT_SECRET la API no arranca', () => {
    process.env.NODE_ENV = 'production';
    expect(cargar).toThrow(/JWT_SECRET es obligatorio/);
  });
});
