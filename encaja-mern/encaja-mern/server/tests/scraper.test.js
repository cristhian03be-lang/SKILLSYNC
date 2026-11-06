// Pruebas del módulo de scraping (runner + fuentes) con MongoDB en memoria.
// Los portales nunca se llaman de verdad: axios se reemplaza por un mock que devuelve los fixtures HTML.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('axios');
const axios = require('axios');

process.env.NODE_ENV = 'test';
const { ejecutarJob, scrapearTodo } = require('../src/services/scraper/runner');
const { buscar } = require('../src/services/scraper/fuentes');
const { descargar } = require('../src/services/scraper/util');
const Carrera = require('../src/models/Carrera');
const Oferta = require('../src/models/Oferta');
const ScrapingJob = require('../src/models/ScrapingJob');
const carreras = require('../src/data/carreras.json');

const CYBER = carreras.find((c) => c.nombre === 'Ingeniería de Ciberseguridad');
const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const HTML = { 'pe.jooble.org': fx('jooble.html'), 'pe.computrabajo.com': fx('computrabajo.html'), 'www.bumeran.com.pe': fx('bumeran.html') };

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Carrera.create(CYBER);
});
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
beforeEach(() => {
  axios.get.mockReset();
  axios.get.mockImplementation(async (url) => ({ data: HTML[new URL(url).host] }));
});

const nuevoJob = (extra = {}) => ScrapingJob.create({ carrera: CYBER.nombre, puesto: CYBER.puesto, ...extra });

describe('descargar y buscar', () => {
  test('descargar envía User-Agent identificable y timeout', async () => {
    const html = await descargar('https://pe.jooble.org/trabajo-soc/Lima');
    expect(html).toContain('/jdp/');
    expect(axios.get).toHaveBeenCalledWith('https://pe.jooble.org/trabajo-soc/Lima',
      expect.objectContaining({ timeout: 15000, headers: expect.objectContaining({ 'User-Agent': expect.stringMatching(/EncajaBot/) }) }));
  });

  test('buscar usa la URL y el parser de cada portal', async () => {
    const ofertas = await buscar('Computrabajo', 'Analista SOC');
    expect(ofertas[0]).toMatchObject({ titulo: 'Analista SOC Junior', fuente: 'Computrabajo' });
    expect(axios.get.mock.calls[0][0]).toBe('https://pe.computrabajo.com/trabajo-de-analista-soc-en-lima');
  });

  test('buscar rechaza una fuente desconocida', async () => {
    await expect(buscar('LinkedIn', 'SOC')).rejects.toThrow('Fuente desconocida: LinkedIn');
  });
});

describe('ejecutarJob', () => {
  test('un job inexistente devuelve null', async () => {
    expect(await ejecutarJob(new mongoose.Types.ObjectId())).toBeNull();
  });

  test('guarda ofertas con competencias detectadas y no duplica en la segunda corrida', async () => {
    const job = await ejecutarJob((await nuevoJob())._id);
    expect(job.estado).toBe('completado');
    expect(job.resultados.map((r) => r.fuente)).toEqual(['Jooble', 'Computrabajo', 'Bumeran']);
    expect(job.totalOfertas).toBeGreaterThan(0);
    expect(job.nuevas).toBe(job.totalOfertas);
    expect(job.inicio).toBeInstanceOf(Date);
    expect(job.fin).toBeInstanceOf(Date);

    const guardadas = await Oferta.find({ job: job._id }).lean();
    expect(guardadas.length).toBe(job.nuevas);
    expect(guardadas.some((o) => o.competencias.length > 0)).toBe(true);
    expect(JSON.stringify(guardadas)).not.toMatch(/<script|onerror/i); // REQ-06

    const otra = await ejecutarJob((await nuevoJob())._id);
    expect(otra.nuevas).toBe(0);
  });

  test('ignora ofertas sin URL y anota el error de un portal sin detener el resto', async () => {
    const buscarFalso = jest.fn(async (fuente) => {
      if (fuente === 'Bumeran') throw new Error('timeout de 15 s');
      return [{ titulo: 'Sin enlace', resumen: '' }, { titulo: 'Analista SOC con Splunk', resumen: 'Linux', url: `https://ej.pe/${fuente}` }];
    });
    const job = await ejecutarJob((await nuevoJob())._id, { buscar: buscarFalso });
    expect(job.estado).toBe('completado');
    expect(job.resultados.find((r) => r.fuente === 'Bumeran').error).toBe('timeout de 15 s');
    expect(job.nuevas).toBe(2);
    expect((await Oferta.findOne({ url: 'https://ej.pe/Jooble' })).competencias).toEqual(expect.arrayContaining(['SIEM (Splunk / Wazuh)', 'Linux básico']));
  });

  test('si ningún portal responde el job queda en error', async () => {
    const job = await ejecutarJob((await nuevoJob({ fuentes: ['Jooble'] }))._id, { buscar: async () => { throw new Error('403'); } });
    expect(job.estado).toBe('error');
    expect(job.error).toBe('Ninguna fuente respondió');
  });

  test('si la carrera fue borrada el job queda en error', async () => {
    const job = await ejecutarJob((await nuevoJob({ carrera: 'Carrera borrada' }))._id, { buscar: jest.fn() });
    expect(job.estado).toBe('error');
    expect(job.error).toBe('La carrera ya no existe');
  });
});

describe('scrapearTodo (cron diario)', () => {
  test('crea y ejecuta un job programado por cada carrera', async () => {
    await ScrapingJob.deleteMany({});
    await scrapearTodo();
    const jobs = await ScrapingJob.find().lean();
    expect(jobs).toHaveLength(await Carrera.countDocuments());
    expect(jobs.every((j) => j.programado && j.estado === 'completado')).toBe(true);
  });
});
