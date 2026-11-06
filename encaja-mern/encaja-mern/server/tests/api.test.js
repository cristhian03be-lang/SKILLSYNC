// Pruebas de integración de toda la API (Express + MongoDB en memoria) para la cobertura mínima del pipeline (85 %).
// Cubren los tres portales: usuario (/api/me), administración (/api/admin) y scraping (/api/scraping).
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-de-pruebas';

jest.mock('../src/services/scraper/runner', () => ({ ejecutarJob: jest.fn(), scrapearTodo: jest.fn() }));
const { ejecutarJob } = require('../src/services/scraper/runner');

const app = require('../src/app');
const { firmar } = require('../src/middleware/auth');
const Usuario = require('../src/models/Usuario');
const Carrera = require('../src/models/Carrera');
const Progreso = require('../src/models/Progreso');
const Cv = require('../src/models/Cv');
const Oferta = require('../src/models/Oferta');
const ScrapingJob = require('../src/models/ScrapingJob');
const Auditoria = require('../src/models/Auditoria');
const carreras = require('../src/data/carreras.json');

const CYBER = 'Ingeniería de Ciberseguridad';
const CV_TEXTO = 'Experiencia en redes TCP/IP, Linux y monitoreo con Wazuh. Inglés intermedio.';
const ID_INEXISTENTE = '64b000000000000000000000';

let mongo;
let n = 0;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function nuevoEstudiante(extra = {}) {
  n += 1;
  const email = `estudiante${n}@test.pe`;
  const r = await request(app).post('/api/auth/registro').send({ nombre: `Estudiante ${n}`, email, password: 'ClaveSegura1' });
  const usuario = await Usuario.findOne({ email });
  if (Object.keys(extra).length) await Usuario.updateOne({ _id: usuario._id }, extra);
  return { token: r.body.token, usuario };
}

async function nuevoAdmin() {
  n += 1;
  const admin = await Usuario.create({ nombre: 'Admin', email: `admin${n}@test.pe`, rol: 'admin', passwordHash: await bcrypt.hash('ClaveAdmin123', 4) });
  return { token: firmar(admin), admin };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Carrera.insertMany(carreras);
});
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
afterEach(() => jest.restoreAllMocks());

describe('app', () => {
  test('GET /api/salud responde ok', async () => {
    const r = await request(app).get('/api/salud');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  test('una ruta inexistente devuelve 404 en JSON', async () => {
    const r = await request(app).get('/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.body.error).toMatch(/no encontrada/i);
  });
});

describe('autenticación (/api/auth)', () => {
  test('registro válido devuelve 201, token y nunca el hash', async () => {
    const r = await request(app).post('/api/auth/registro').send({ nombre: 'Ana', email: 'ANA@Test.pe', password: 'ClaveSegura1' });
    expect(r.status).toBe(201);
    expect(r.body.token).toBeDefined();
    expect(r.body.usuario).toMatchObject({ email: 'ana@test.pe', rol: 'estudiante' });
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash/);
  });

  test('registro con correo repetido devuelve 409', async () => {
    const r = await request(app).post('/api/auth/registro').send({ nombre: 'Ana', email: 'ana@test.pe', password: 'ClaveSegura1' });
    expect(r.status).toBe(409);
  });

  test('registro con datos inválidos devuelve 400 con detalle', async () => {
    const r = await request(app).post('/api/auth/registro').send({ nombre: 'A', email: 'no-es-correo', password: '123' });
    expect(r.status).toBe(400);
    expect(r.body.detalle.length).toBeGreaterThan(0);
  });

  test('login con correo inexistente devuelve 401 genérico', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'nadie@test.pe', password: 'loquesea' });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Correo o contraseña incorrectos.');
  });

  test('login correcto devuelve token, reinicia intentos y registra auditoría', async () => {
    await request(app).post('/api/auth/login').send({ email: 'ana@test.pe', password: 'mala' });
    const r = await request(app).post('/api/auth/login').send({ email: 'ana@test.pe', password: 'ClaveSegura1' });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeDefined();
    const u = await Usuario.findOne({ email: 'ana@test.pe' }).select('+intentosFallidos');
    expect(u.intentosFallidos).toBe(0);
    expect(u.ultimoAcceso).toBeInstanceOf(Date);
    expect(await Auditoria.exists({ email: 'ana@test.pe', accion: 'login_ok' })).toBeTruthy();
    expect(await Auditoria.exists({ email: 'ana@test.pe', accion: 'login_fallido' })).toBeTruthy();
  });

  test('un bloqueo ya vencido permite volver a entrar', async () => {
    await Usuario.updateOne({ email: 'ana@test.pe' }, { bloqueadoHasta: new Date(Date.now() - 60000) });
    const r = await request(app).post('/api/auth/login').send({ email: 'ana@test.pe', password: 'ClaveSegura1' });
    expect(r.status).toBe(200);
  });

  test('una cuenta bloqueada informa los minutos restantes (423)', async () => {
    await Usuario.updateOne({ email: 'ana@test.pe' }, { bloqueadoHasta: new Date(Date.now() + 10 * 60000) });
    const r = await request(app).post('/api/auth/login').send({ email: 'ana@test.pe', password: 'ClaveSegura1' });
    expect(r.status).toBe(423);
    expect(r.body.error).toMatch(/10 min/);
  });

  test('GET /api/auth/me devuelve el usuario del token', async () => {
    const { token, usuario } = await nuevoEstudiante();
    const r = await request(app).get('/api/auth/me').set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body.usuario.email).toBe(usuario.email);
  });

  test('un token de un usuario que ya no existe devuelve 401', async () => {
    const fantasma = new Usuario({ nombre: 'Fantasma', email: 'f@test.pe', passwordHash: 'x' });
    const r = await request(app).get('/api/auth/me').set(auth(firmar(fantasma)));
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/no encontrado/i);
  });
});

describe('portal del usuario (/api/me)', () => {
  test('sin carrera elegida el progreso está vacío', async () => {
    const { token } = await nuevoEstudiante();
    const r = await request(app).get('/api/me/progreso').set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ carrera: null, encaje: { pct: 0, lista: [] }, historial: [] });
  });

  test('sin carrera no se puede marcar progreso ni analizar el CV (400)', async () => {
    const { token } = await nuevoEstudiante();
    expect((await request(app).put('/api/me/progreso').set(auth(token)).send({ competencia: 'X', paso: 0, completado: true })).status).toBe(400);
    expect((await request(app).get('/api/me/analisis').set(auth(token))).status).toBe(400);
  });

  test('elegir una carrera inexistente devuelve 404', async () => {
    const { token } = await nuevoEstudiante();
    const r = await request(app).put('/api/me/carrera').set(auth(token)).send({ carrera: 'Astronauta' });
    expect(r.status).toBe(404);
  });

  test('elegir carrera, marcar pasos y ver el encaje subir', async () => {
    const { token } = await nuevoEstudiante();
    const elegir = await request(app).put('/api/me/carrera').set(auth(token)).send({ carrera: CYBER });
    expect(elegir.status).toBe(200);
    expect(elegir.body.encaje.pct).toBe(0);
    expect(elegir.body.historial).toEqual([]);

    const p1 = await request(app).put('/api/me/progreso').set(auth(token))
      .send({ competencia: 'Redes y TCP/IP', paso: 0, completado: true, enlace: 'https://github.com/ana/lab-redes' });
    expect(p1.status).toBe(200);
    expect(p1.body.encaje.pct).toBeGreaterThan(0);
    const redes = p1.body.encaje.lista.find((c) => c.nombre === 'Redes y TCP/IP');
    expect(redes).toMatchObject({ hechos: 1, enlace: 'https://github.com/ana/lab-redes' });
    expect(p1.body.historial[0].texto).toBe('Redes y TCP/IP · Aprender');

    // mismo ítem, otro paso, sin enlace
    const p2 = await request(app).put('/api/me/progreso').set(auth(token)).send({ competencia: 'Redes y TCP/IP', paso: 1, completado: true });
    expect(p2.body.encaje.lista.find((c) => c.nombre === 'Redes y TCP/IP').hechos).toBe(2);

    // otro ítem en el mismo progreso
    await request(app).put('/api/me/progreso').set(auth(token)).send({ competencia: 'Linux básico', paso: 2, completado: true });

    // desmarcar un paso no agrega historial
    const p3 = await request(app).put('/api/me/progreso').set(auth(token)).send({ competencia: 'Redes y TCP/IP', paso: 1, completado: false });
    expect(p3.body.encaje.lista.find((c) => c.nombre === 'Redes y TCP/IP').hechos).toBe(1);
    expect(p3.body.historial).toHaveLength(3);

    const get = await request(app).get('/api/me/progreso').set(auth(token));
    expect(get.body.carrera.nombre).toBe(CYBER);
  });

  test('marcar una competencia que no es de la carrera devuelve 404', async () => {
    const { token } = await nuevoEstudiante({ carrera: CYBER });
    const r = await request(app).put('/api/me/progreso').set(auth(token)).send({ competencia: 'Cocina molecular', paso: 0, completado: true });
    expect(r.status).toBe(404);
  });

  test('un paso fuera de rango se rechaza con 400', async () => {
    const { token } = await nuevoEstudiante({ carrera: CYBER });
    const r = await request(app).put('/api/me/progreso').set(auth(token)).send({ competencia: 'Redes y TCP/IP', paso: 5, completado: true });
    expect(r.status).toBe(400);
  });

  test('CV: guardar, leer, leer por id, reemplazar y borrar', async () => {
    const { token } = await nuevoEstudiante();
    expect((await request(app).get('/api/me/cv').set(auth(token))).body.cv).toBeNull();

    const put = await request(app).put('/api/me/cv').set(auth(token)).send({ texto: CV_TEXTO, nombreArchivo: 'cv.txt' });
    expect(put.status).toBe(200);
    expect(put.body.cv.nombreArchivo).toBe('cv.txt');

    const otra = await request(app).put('/api/me/cv').set(auth(token)).send({ texto: `${CV_TEXTO} Python.` });
    expect(otra.body.cv.nombreArchivo).toBe('');
    expect(String(otra.body.cv._id)).toBe(String(put.body.cv._id)); // un CV por usuario

    const propio = await request(app).get(`/api/me/cv/${put.body.cv._id}`).set(auth(token));
    expect(propio.status).toBe(200);
    expect(propio.body.cv.texto).toMatch(/Python/);

    expect((await request(app).get('/api/me/cv').set(auth(token))).body.cv.texto).toMatch(/Python/);
    expect((await request(app).delete('/api/me/cv').set(auth(token))).body).toEqual({ ok: true });
    expect(await Cv.countDocuments({ _id: put.body.cv._id })).toBe(0);
  });

  test('CV: un id inexistente es 404 y un id mal formado es 400', async () => {
    const { token } = await nuevoEstudiante();
    expect((await request(app).get(`/api/me/cv/${ID_INEXISTENTE}`).set(auth(token))).status).toBe(404);
    const malo = await request(app).get('/api/me/cv/no-es-un-id').set(auth(token));
    expect(malo.status).toBe(400);
    expect(malo.body.error).toBe('Identificador inválido.');
  });

  test('CV demasiado corto se rechaza con 400', async () => {
    const { token } = await nuevoEstudiante();
    expect((await request(app).put('/api/me/cv').set(auth(token)).send({ texto: 'corto' })).status).toBe(400);
  });

  test('análisis: sin CV es 404; con CV cruza contra las ofertas reales', async () => {
    const { token } = await nuevoEstudiante({ carrera: CYBER });
    expect((await request(app).get('/api/me/analisis').set(auth(token))).status).toBe(404);

    await Oferta.create([
      { titulo: 'Analista SOC', url: 'https://ej.pe/soc-1', fuente: 'Jooble', carrera: CYBER, competencias: ['Redes y TCP/IP', 'SIEM (Splunk / Wazuh)'] },
      { titulo: 'Analista SOC II', url: 'https://ej.pe/soc-2', fuente: 'Bumeran', carrera: CYBER, competencias: ['Redes y TCP/IP', 'Excel'] },
    ]);
    await request(app).put('/api/me/cv').set(auth(token)).send({ texto: CV_TEXTO });
    const r = await request(app).get('/api/me/analisis').set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body.totalOfertas).toBe(2);
    expect(r.body.enVivo).toBe(true);
    expect(r.body.tienes.map((c) => c.nombre)).toEqual(expect.arrayContaining(['Redes y TCP/IP']));
    expect(r.body.faltan.map((c) => c.nombre)).toContain('Excel');
    expect(r.body.cobertura).toBeGreaterThan(0);
  });

  test('eliminar la cuenta borra usuario, CV y progreso (Ley 29733)', async () => {
    const { token, usuario } = await nuevoEstudiante();
    await request(app).put('/api/me/carrera').set(auth(token)).send({ carrera: CYBER });
    await request(app).put('/api/me/progreso').set(auth(token)).send({ competencia: 'Linux básico', paso: 0, completado: true });
    await request(app).put('/api/me/cv').set(auth(token)).send({ texto: CV_TEXTO });

    expect((await request(app).delete('/api/me/cuenta').set(auth(token))).body).toEqual({ ok: true });
    expect(await Usuario.exists({ _id: usuario._id })).toBeNull();
    expect(await Cv.exists({ usuario: usuario._id })).toBeNull();
    expect(await Progreso.exists({ usuario: usuario._id })).toBeNull();
    expect((await request(app).get('/api/me/progreso').set(auth(token))).status).toBe(401);
  });
});

describe('rutas públicas', () => {
  test('GET /api/carreras devuelve las 19 carreras ordenadas', async () => {
    const r = await request(app).get('/api/carreras');
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(19);
    const nombres = r.body.map((c) => c.nombre);
    expect(nombres).toEqual([...nombres].sort());
  });

  test('GET /api/ofertas filtra por carrera y sin carrera devuelve vacío', async () => {
    const r = await request(app).get('/api/ofertas').query({ carrera: CYBER });
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/ofertas')).body).toEqual([]);
  });

  test('GET /api/demanda: 404 si la carrera no existe; % por competencia si existe', async () => {
    expect((await request(app).get('/api/demanda')).status).toBe(404);
    const r = await request(app).get('/api/demanda').query({ carrera: CYBER });
    expect(r.status).toBe(200);
    expect(r.body.competencias[0]).toHaveProperty('pct');
  });

  test('una inyección NoSQL en la consulta pública se trata como texto', async () => {
    const r = await request(app).get('/api/ofertas?carrera[$ne]=x');
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });
});

describe('panel administrativo (/api/admin)', () => {
  const nuevaCarrera = { nombre: 'Ingeniería Ambiental', puesto: 'Asistente ambiental', competencias: [{ nombre: 'ISO 14001', peso: 70 }] };
  let token;
  let admin;
  let carreraId;

  beforeAll(async () => { ({ token, admin } = await nuevoAdmin()); });

  test('crea una carrera (201) y audita la acción', async () => {
    const r = await request(app).post('/api/admin/carreras').set(auth(token)).send(nuevaCarrera);
    expect(r.status).toBe(201);
    expect(r.body.icono).toBe('🎓');
    carreraId = r.body._id;
    expect(await Auditoria.exists({ accion: 'admin_crear_carrera', detalle: nuevaCarrera.nombre })).toBeTruthy();
  });

  test('una carrera duplicada devuelve 409', async () => {
    expect((await request(app).post('/api/admin/carreras').set(auth(token)).send(nuevaCarrera)).status).toBe(409);
  });

  test('una carrera sin competencias devuelve 400', async () => {
    expect((await request(app).post('/api/admin/carreras').set(auth(token)).send({ ...nuevaCarrera, competencias: [] })).status).toBe(400);
  });

  test('editar sin cambiar el nombre', async () => {
    const r = await request(app).put(`/api/admin/carreras/${carreraId}`).set(auth(token)).send({ ...nuevaCarrera, puesto: 'Analista ambiental' });
    expect(r.status).toBe(200);
    expect(r.body.puesto).toBe('Analista ambiental');
  });

  test('renombrar una carrera actualiza usuarios, progresos y ofertas', async () => {
    const { usuario } = await nuevoEstudiante({ carrera: nuevaCarrera.nombre });
    await Progreso.create({ usuario: usuario._id, carrera: nuevaCarrera.nombre });
    await Oferta.create({ titulo: 'Asistente', url: 'https://ej.pe/amb-1', fuente: 'Jooble', carrera: nuevaCarrera.nombre });

    const r = await request(app).put(`/api/admin/carreras/${carreraId}`).set(auth(token)).send({ ...nuevaCarrera, nombre: 'Ingeniería Ambiental y de Recursos' });
    expect(r.status).toBe(200);
    expect((await Usuario.findById(usuario._id)).carrera).toBe('Ingeniería Ambiental y de Recursos');
    expect(await Progreso.exists({ usuario: usuario._id, carrera: 'Ingeniería Ambiental y de Recursos' })).toBeTruthy();
    expect(await Oferta.exists({ url: 'https://ej.pe/amb-1', carrera: 'Ingeniería Ambiental y de Recursos' })).toBeTruthy();
  });

  test('editar o borrar una carrera inexistente es 404; un id mal formado es 400', async () => {
    expect((await request(app).put(`/api/admin/carreras/${ID_INEXISTENTE}`).set(auth(token)).send(nuevaCarrera)).status).toBe(404);
    expect((await request(app).delete(`/api/admin/carreras/${ID_INEXISTENTE}`).set(auth(token))).status).toBe(404);
    expect((await request(app).put('/api/admin/carreras/xyz').set(auth(token)).send(nuevaCarrera)).status).toBe(400);
    expect((await request(app).delete('/api/admin/carreras/xyz').set(auth(token))).status).toBe(400);
  });

  test('borra una carrera', async () => {
    const r = await request(app).delete(`/api/admin/carreras/${carreraId}`).set(auth(token));
    expect(r.body).toEqual({ ok: true });
    expect(await Carrera.exists({ _id: carreraId })).toBeNull();
  });

  test('lista usuarios con encaje y si tienen CV', async () => {
    const { token: t, usuario } = await nuevoEstudiante();
    await request(app).put('/api/me/carrera').set(auth(t)).send({ carrera: CYBER });
    await request(app).put('/api/me/progreso').set(auth(t)).send({ competencia: 'Redes y TCP/IP', paso: 0, completado: true });
    await request(app).put('/api/me/cv').set(auth(t)).send({ texto: CV_TEXTO });

    const r = await request(app).get('/api/admin/usuarios').set(auth(token));
    expect(r.status).toBe(200);
    const fila = r.body.find((u) => u.email === usuario.email);
    expect(fila.tieneCv).toBe(true);
    expect(fila.encaje).toBeGreaterThan(0);
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash/);
  });

  test('cambiar rol: no a sí mismo (400), usuario inexistente (404), correcto (200)', async () => {
    const { usuario } = await nuevoEstudiante();
    expect((await request(app).patch(`/api/admin/usuarios/${admin._id}/rol`).set(auth(token)).send({ rol: 'estudiante' })).status).toBe(400);
    expect((await request(app).patch(`/api/admin/usuarios/${ID_INEXISTENTE}/rol`).set(auth(token)).send({ rol: 'admin' })).status).toBe(404);
    expect((await request(app).patch(`/api/admin/usuarios/${usuario._id}/rol`).set(auth(token)).send({ rol: 'superusuario' })).status).toBe(400);
    expect((await request(app).patch('/api/admin/usuarios/xyz/rol').set(auth(token)).send({ rol: 'admin' })).status).toBe(400);
    const ok = await request(app).patch(`/api/admin/usuarios/${usuario._id}/rol`).set(auth(token)).send({ rol: 'admin' });
    expect(ok.status).toBe(200);
    expect(ok.body.rol).toBe('admin');
    expect(await Auditoria.exists({ accion: 'admin_cambiar_rol' })).toBeTruthy();
  });

  test('eliminar usuario: no a sí mismo (400), inexistente (404), correcto borra sus datos', async () => {
    const { token: t, usuario } = await nuevoEstudiante();
    await request(app).put('/api/me/cv').set(auth(t)).send({ texto: CV_TEXTO });
    expect((await request(app).delete(`/api/admin/usuarios/${admin._id}`).set(auth(token))).status).toBe(400);
    expect((await request(app).delete(`/api/admin/usuarios/${ID_INEXISTENTE}`).set(auth(token))).status).toBe(404);
    expect((await request(app).delete('/api/admin/usuarios/xyz').set(auth(token))).status).toBe(400);
    expect((await request(app).delete(`/api/admin/usuarios/${usuario._id}`).set(auth(token))).body).toEqual({ ok: true });
    expect(await Usuario.exists({ _id: usuario._id })).toBeNull();
    expect(await Cv.exists({ usuario: usuario._id })).toBeNull();
  });

  test('las métricas resumen estudiantes, encaje, competencias y seguridad', async () => {
    const r = await request(app).get('/api/admin/metricas').set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body.totales.estudiantes).toBeGreaterThan(0);
    expect(r.body.encajePromedio).toBeGreaterThanOrEqual(0);
    expect(r.body.carrerasMasElegidas[0]).toHaveProperty('n');
    expect(r.body.competenciasMasPedidas.length).toBeGreaterThan(0);
    expect(r.body.ofertasPorFuente.length).toBeGreaterThan(0);
    expect(r.body.seguridad7dias).toHaveProperty('loginsOk');
  });

  test('sin estudiantes con carrera el encaje promedio es 0', async () => {
    jest.spyOn(Usuario, 'find').mockReturnValueOnce({ lean: async () => [{ _id: 'x', rol: 'estudiante', carrera: null }] });
    const r = await request(app).get('/api/admin/metricas').set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body.encajePromedio).toBe(0);
  });

  test('la auditoría devuelve los últimos eventos', async () => {
    const r = await request(app).get('/api/admin/auditoria').set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
  });
});

describe('panel de scraping (/api/scraping)', () => {
  let token;
  let jobId;

  beforeAll(async () => { ({ token } = await nuevoAdmin()); });

  test('lista las fuentes disponibles', async () => {
    const r = await request(app).get('/api/scraping/fuentes').set(auth(token));
    expect(r.body).toEqual(['Jooble', 'Computrabajo', 'Bumeran']);
  });

  test('lanzar un job: 404 si la carrera no existe', async () => {
    expect((await request(app).post('/api/scraping/jobs').set(auth(token)).send({ carrera: 'Astronauta' })).status).toBe(404);
  });

  test('lanzar un job con puesto y fuentes propias (202) y auditarlo', async () => {
    const r = await request(app).post('/api/scraping/jobs').set(auth(token)).send({ carrera: CYBER, puesto: 'Analista SOC', fuentes: ['Jooble'] });
    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ puesto: 'Analista SOC', fuentes: ['Jooble'], estado: 'pendiente' });
    jobId = r.body._id;
    expect(await Auditoria.exists({ accion: 'scraping_lanzado' })).toBeTruthy();
    expect(ejecutarJob).not.toHaveBeenCalled(); // en modo test no se descarga nada
  });

  test('una fuente desconocida se rechaza con 400', async () => {
    expect((await request(app).post('/api/scraping/jobs').set(auth(token)).send({ carrera: CYBER, fuentes: ['LinkedIn'] })).status).toBe(400);
  });

  test('fuera de modo test el job se ejecuta en segundo plano y sus errores no tumban la API', async () => {
    ejecutarJob.mockRejectedValueOnce(new Error('portal caído'));
    process.env.NODE_ENV = 'development';
    try {
      const r = await request(app).post('/api/scraping/jobs').set(auth(token)).send({ carrera: CYBER });
      expect(r.status).toBe(202);
      expect(r.body.puesto).toBe('Analista SOC junior'); // sin puesto usa el de la carrera
      await new Promise((ok) => setImmediate(ok));
      expect(ejecutarJob).toHaveBeenCalledTimes(1);
    } finally {
      process.env.NODE_ENV = 'test';
    }
  });

  test('lista jobs y consulta uno por id (404 / 400 si no existe o es inválido)', async () => {
    const lista = await request(app).get('/api/scraping/jobs').set(auth(token));
    expect(lista.body.length).toBeGreaterThan(0);
    expect((await request(app).get(`/api/scraping/jobs/${jobId}`).set(auth(token))).body._id).toBe(jobId);
    expect((await request(app).get(`/api/scraping/jobs/${ID_INEXISTENTE}`).set(auth(token))).status).toBe(404);
    expect((await request(app).get('/api/scraping/jobs/xyz').set(auth(token))).status).toBe(400);
  });

  test('lista ofertas (todas o por carrera) y borra una', async () => {
    const todas = await request(app).get('/api/scraping/ofertas').set(auth(token));
    expect(todas.body.length).toBeGreaterThan(0);
    const cyber = await request(app).get('/api/scraping/ofertas').query({ carrera: CYBER }).set(auth(token));
    expect(cyber.body.every((o) => o.carrera === CYBER)).toBe(true);

    const id = cyber.body[0]._id;
    expect((await request(app).delete(`/api/scraping/ofertas/${id}`).set(auth(token))).body).toEqual({ ok: true });
    expect(await Oferta.exists({ _id: id })).toBeNull();
    expect((await request(app).delete('/api/scraping/ofertas/xyz').set(auth(token))).status).toBe(400);
  });
});

// Si la base de datos falla, cada ruta responde 500 sin mostrar detalles internos
describe('errores inesperados de la base de datos (500 genérico)', () => {
  let est;
  let adm;
  beforeAll(async () => {
    est = (await nuevoEstudiante({ carrera: CYBER })).token;
    adm = (await nuevoAdmin()).token;
    await request(app).put('/api/me/cv').set(auth(est)).send({ texto: CV_TEXTO });
  });

  const falla = () => { throw new Error('MongoDB caído: detalle interno'); };
  const casos = [
    ['POST /api/auth/registro', () => Usuario, 'exists', (r) => r.post('/api/auth/registro').send({ nombre: 'Err', email: 'err@test.pe', password: 'ClaveSegura1' })],
    ['POST /api/auth/login', () => Usuario, 'findOne', (r) => r.post('/api/auth/login').send({ email: 'err@test.pe', password: 'x' })],
    ['GET /api/carreras', () => Carrera, 'find', (r) => r.get('/api/carreras')],
    ['GET /api/ofertas', () => Oferta, 'find', (r) => r.get('/api/ofertas')],
    ['GET /api/demanda', () => Carrera, 'findOne', (r) => r.get('/api/demanda')],
    ['PUT /api/me/carrera', () => Carrera, 'exists', (r) => r.put('/api/me/carrera').set(auth(est)).send({ carrera: CYBER })],
    ['GET /api/me/progreso', () => Carrera, 'findOne', (r) => r.get('/api/me/progreso').set(auth(est))],
    ['PUT /api/me/progreso', () => Carrera, 'findOne', (r) => r.put('/api/me/progreso').set(auth(est)).send({ competencia: 'Linux básico', paso: 0, completado: true })],
    ['GET /api/me/cv', () => Cv, 'findOne', (r) => r.get('/api/me/cv').set(auth(est))],
    ['PUT /api/me/cv', () => Cv, 'findOneAndUpdate', (r) => r.put('/api/me/cv').set(auth(est)).send({ texto: CV_TEXTO })],
    ['DELETE /api/me/cv', () => Cv, 'deleteOne', (r) => r.delete('/api/me/cv').set(auth(est))],
    ['GET /api/me/analisis', () => Cv, 'findOne', (r) => r.get('/api/me/analisis').set(auth(est))],
    ['DELETE /api/me/cuenta', () => Progreso, 'deleteMany', (r) => r.delete('/api/me/cuenta').set(auth(est))],
    ['POST /api/admin/carreras', () => Carrera, 'create', (r) => r.post('/api/admin/carreras').set(auth(adm)).send({ nombre: 'Err', puesto: 'Err', competencias: [{ nombre: 'X', peso: 10 }] })],
    ['GET /api/admin/usuarios', () => Usuario, 'find', (r) => r.get('/api/admin/usuarios').set(auth(adm))],
    ['GET /api/admin/metricas', () => Usuario, 'find', (r) => r.get('/api/admin/metricas').set(auth(adm))],
    ['GET /api/admin/auditoria', () => Auditoria, 'find', (r) => r.get('/api/admin/auditoria').set(auth(adm))],
    ['POST /api/scraping/jobs', () => Carrera, 'findOne', (r) => r.post('/api/scraping/jobs').set(auth(adm)).send({ carrera: CYBER })],
    ['GET /api/scraping/jobs', () => ScrapingJob, 'find', (r) => r.get('/api/scraping/jobs').set(auth(adm))],
    ['GET /api/scraping/ofertas', () => Oferta, 'find', (r) => r.get('/api/scraping/ofertas').set(auth(adm))],
  ];

  test.each(casos)('%s responde 500 sin filtrar el error', async (_, modelo, metodo, llamar) => {
    jest.spyOn(modelo(), metodo).mockImplementationOnce(falla);
    const r = await llamar(request(app));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: 'Error interno del servidor.' });
  });
});
