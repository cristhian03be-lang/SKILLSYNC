const { Schema, model } = require('mongoose');

const CompetenciaSchema = new Schema({
  nombre: { type: String, required: true, trim: true },
  peso: { type: Number, min: 1, max: 100, default: 50 },   // % de vacantes que la piden (catálogo)
  recurso: { type: String, default: '' },                  // curso o práctica sugerida
  video: { type: String, default: '' },                    // URL de YouTube opcional
}, { _id: false });

const CarreraSchema = new Schema({
  nombre: { type: String, required: true, unique: true, trim: true },
  puesto: { type: String, required: true, trim: true },
  icono: { type: String, default: '🎓' },
  competencias: { type: [CompetenciaSchema], default: [] },
}, { timestamps: true });

module.exports = model('Carrera', CarreraSchema);
