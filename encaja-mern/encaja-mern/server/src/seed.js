// Carga las 19 carreras, crea el administrador y guarda ofertas reales de muestra (Jooble Perú, 17/09/2026)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const Carrera = require('./models/Carrera');
const Usuario = require('./models/Usuario');
const Oferta = require('./models/Oferta');
const { detectar } = require('./services/competencias');
const carreras = require('./data/carreras.json');
const muestra = require('./data/ofertas-muestra.json');

(async () => {
  await mongoose.connect(config.mongoUri);
  for (const c of carreras) await Carrera.updateOne({ nombre: c.nombre }, { $setOnInsert: c }, { upsert: true });
  console.log(`Carreras: ${await Carrera.countDocuments()}`);

  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const pass = process.env.ADMIN_PASSWORD || '';
  if (email && pass.length >= 8) {
    await Usuario.updateOne({ email }, { $setOnInsert: { nombre: 'Administrador', email, rol: 'admin', passwordHash: await bcrypt.hash(pass, 12) } }, { upsert: true });
    console.log(`Administrador: ${email}`);
  } else {
    console.log('Define ADMIN_EMAIL y ADMIN_PASSWORD (mín. 8 caracteres) en .env para crear el administrador.');
  }

  let n = 0;
  for (const [nombre, data] of Object.entries(muestra)) {
    if (nombre === 'fecha') continue;
    const carrera = carreras.find((c) => c.nombre === nombre);
    for (const o of data.ofertas) {
      await Oferta.updateOne({ url: o.url }, { $setOnInsert: { titulo: o.titulo, empresa: o.empresa, lugar: o.lugar, resumen: o.resumen,
        url: o.url, publicada: o.cuando, fuente: 'Muestra', carrera: nombre, puesto: carrera?.puesto || '',
        competencias: detectar(`${o.titulo} ${o.resumen}`, carrera) } }, { upsert: true });
      n += 1;
    }
  }
  console.log(`Ofertas de muestra: ${n}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
