// Pruebas de los requisitos de seguridad contra la API real con MongoDB en memoria
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-de-pruebas';
const app = require('../src/app');
const Usuario = require('../src/models/Usuario');
const Carrera = require('../src/models/Carrera');
const bcrypt = require('bcryptjs');
const carreras = require('../src/data/carreras.json');

let mongo;
const registrar = async (email) => (await request(app).post('/api/auth/registro').send({ nombre: 'Test', email, password: 'ClaveSegura1' })).body.token;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Carrera.insertMany(carreras);
});
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

// TEST-01 (REQ-01)
test('TEST-01: al 5.º intento fallido la cuenta queda bloqueada 15 min (423), aunque luego la clave sea correcta', async () => {
  await registrar('bloqueo@test.pe');
  for (let i = 1; i <= 4; i += 1) {
    const r = await request(app).post('/api/auth/login').send({ email: 'bloqueo@test.pe', password: 'incorrecta' });
    expect(r.status).toBe(401);
  }
  const quinto = await request(app).post('/api/auth/login').send({ email: 'bloqueo@test.pe', password: 'incorrecta' });
  expect(quinto.status).toBe(423);
  const correcta = await request(app).post('/api/auth/login').send({ email: 'bloqueo@test.pe', password: 'ClaveSegura1' });
  expect(correcta.status).toBe(423);
});

// TEST-02 (REQ-02)
test('TEST-02: una inyección NoSQL en el login responde 400 y no emite token', async () => {
  const r = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
  expect(r.status).toBe(400);
  expect(r.body.token).toBeUndefined();
});

// TEST-03 (REQ-03)
test('TEST-03: el usuario B no puede leer el CV del usuario A (403) y sin token es 401', async () => {
  const a = await registrar('a@test.pe');
  const b = await registrar('b@test.pe');
  const cv = await request(app).put('/api/me/cv').set('Authorization', `Bearer ${a}`).send({ texto: 'Redes TCP/IP, Linux y Python. Experiencia en soporte.' });
  const id = cv.body.cv._id;
  const deB = await request(app).get(`/api/me/cv/${id}`).set('Authorization', `Bearer ${b}`);
  expect(deB.status).toBe(403);
  expect(deB.body.cv).toBeUndefined();
  expect((await request(app).get(`/api/me/cv/${id}`)).status).toBe(401);
  expect((await request(app).get(`/api/me/cv/${id}`).set('Authorization', 'Bearer token.falso.vencido')).status).toBe(401);
});

// TEST-04 (REQ-04)
test('TEST-04: un estudiante no puede usar el panel administrativo ni el de scraping (403)', async () => {
  const t = await registrar('estudiante@test.pe');
  const c = await Carrera.findOne();
  expect((await request(app).delete(`/api/admin/carreras/${c._id}`).set('Authorization', `Bearer ${t}`)).status).toBe(403);
  expect((await request(app).post('/api/scraping/jobs').set('Authorization', `Bearer ${t}`).send({ carrera: c.nombre })).status).toBe(403);
  expect(await Carrera.exists({ _id: c._id })).toBeTruthy();
});

test('el administrador sí puede ver métricas y lanzar scraping', async () => {
  await Usuario.create({ nombre: 'Admin', email: 'admin@test.pe', rol: 'admin', passwordHash: await bcrypt.hash('ClaveAdmin123', 4) });
  const { body } = await request(app).post('/api/auth/login').send({ email: 'admin@test.pe', password: 'ClaveAdmin123' });
  const h = { Authorization: `Bearer ${body.token}` };
  expect((await request(app).get('/api/admin/metricas').set(h)).status).toBe(200);
  const job = await request(app).post('/api/scraping/jobs').set(h).send({ carrera: 'Marketing' });
  expect(job.status).toBe(202);
});
