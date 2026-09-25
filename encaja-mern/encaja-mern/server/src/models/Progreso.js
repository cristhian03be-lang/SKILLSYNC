const { Schema, model, Types } = require('mongoose');

const ItemSchema = new Schema({
  competencia: { type: String, required: true },
  pasos: { type: [Boolean], default: [false, false, false] }, // aprender, practicar, demostrar
  enlace: { type: String, default: '' },                     // proyecto de portafolio
}, { _id: false });

const ProgresoSchema = new Schema({
  usuario: { type: Types.ObjectId, ref: 'Usuario', required: true, index: true },
  carrera: { type: String, required: true },
  items: { type: [ItemSchema], default: [] },
  historial: [{ fecha: { type: Date, default: Date.now }, texto: String }],
}, { timestamps: true });
ProgresoSchema.index({ usuario: 1, carrera: 1 }, { unique: true });

module.exports = model('Progreso', ProgresoSchema);
