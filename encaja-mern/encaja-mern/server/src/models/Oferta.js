const { Schema, model } = require('mongoose');

const OfertaSchema = new Schema({
  titulo: { type: String, required: true },
  empresa: { type: String, default: '' },
  lugar: { type: String, default: '' },
  resumen: { type: String, default: '' },
  url: { type: String, required: true, unique: true },
  fuente: { type: String, enum: ['Computrabajo', 'Bumeran', 'Jooble', 'Muestra'], required: true },
  carrera: { type: String, required: true, index: true },
  puesto: { type: String, default: '' },
  competencias: { type: [String], default: [] }, // detectadas por palabras clave
  publicada: { type: String, default: '' },       // "hace 2 días" tal como lo muestra el portal
  job: { type: Schema.Types.ObjectId, ref: 'ScrapingJob' },
}, { timestamps: true });

module.exports = model('Oferta', OfertaSchema);
