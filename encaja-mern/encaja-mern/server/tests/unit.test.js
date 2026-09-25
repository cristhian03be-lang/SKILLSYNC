// Pruebas que no necesitan base de datos: detección de competencias, parsers y limpieza (REQ-06)
const fs = require('fs');
const path = require('path');
const { detectar, incluye, demanda, cruzarCv } = require('../src/services/competencias');
const { parseJooble, parseComputrabajo, parseBumeran } = require('../src/services/scraper/fuentes');
const carreras = require('../src/data/carreras.json');

const cyber = carreras.find((c) => c.nombre === 'Ingeniería de Ciberseguridad');
const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

describe('detección de competencias', () => {
  test('usa límite de palabra en claves cortas', () => {
    expect(incluye('asistente de digital risk', 'git')).toBe(false);
    expect(incluye('manejo de git y github', 'git')).toBe(true);
  });
  test('reconoce sinónimos del catálogo (QRadar cuenta como SIEM)', () => {
    expect(detectar('Monitoreo con QRadar y redes Cisco', cyber)).toEqual(expect.arrayContaining(['SIEM (Splunk / Wazuh)', 'Redes y TCP/IP']));
  });
  test('detecta competencias nuevas del mercado fuera del catálogo', () => {
    expect(detectar('Se requiere Excel avanzado', cyber)).toContain('Excel');
  });
  test('cruce de CV: cobertura ponderada por demanda', () => {
    const dem = demanda([{ competencias: ['Redes y TCP/IP', 'Excel'] }, { competencias: ['Redes y TCP/IP'] }], cyber);
    const r = cruzarCv('Conozco redes TCP/IP y Linux', dem, cyber);
    expect(r.tienes.map((c) => c.nombre)).toContain('Redes y TCP/IP');
    expect(r.faltan.map((c) => c.nombre)).toContain('Excel');
    expect(r.cobertura).toBeGreaterThan(0);
  });
});

describe('parsers de portales', () => {
  test('Jooble', () => {
    const o = parseJooble(fx('jooble.html'));
    expect(o).toHaveLength(3);
    expect(o[0]).toMatchObject({ titulo: 'SOC Analyst L1 / Analista de Ciberseguridad', fuente: 'Jooble', url: 'https://pe.jooble.org/jdp/5740950217628715253' });
  });
  test('Computrabajo', () => {
    expect(parseComputrabajo(fx('computrabajo.html'))[0]).toMatchObject({ titulo: 'Analista SOC Junior', empresa: 'Banco ABC' });
  });
  test('Bumeran', () => {
    expect(parseBumeran(fx('bumeran.html'))[0]).toMatchObject({ titulo: 'Practicante de TI', url: 'https://www.bumeran.com.pe/empleos/practicante-ti-123.html' });
  });
  // TEST-05 (REQ-06): una oferta con HTML malicioso se guarda sin etiquetas ni atributos ejecutables
  test('TEST-05: el HTML malicioso de una oferta queda como texto plano', () => {
    const todo = JSON.stringify(parseJooble(fx('jooble.html')));
    expect(todo).not.toMatch(/onerror|<script|<img/i);
  });
});
