const { Schema, model, Types } = require('mongoose');

const ScrapingJobSchema = new Schema({
  carrera: { type: String, required: true },
  puesto: { type: String, required: true },
  fuentes: { type: [String], default: ['Jooble', 'Computrabajo', 'Bumeran'] },
  estado: { type: String, enum: ['pendiente', 'ejecutando', 'completado', 'error'], default: 'pendiente' },
  programado: { type: Boolean, default: false },
  iniciadoPor: { type: Types.ObjectId, ref: 'Usuario' },
  resultados: [{ fuente: String, encontradas: Number, error: String }],
  totalOfertas: { type: Number, default: 0 },
  nuevas: { type: Number, default: 0 },
  error: { type: String, default: '' },
  inicio: Date,
  fin: Date,
}, { timestamps: true });

module.exports = model('ScrapingJob', ScrapingJobSchema);
