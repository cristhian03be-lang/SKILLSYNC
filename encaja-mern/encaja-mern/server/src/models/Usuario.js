const { Schema, model } = require('mongoose');

const UsuarioSchema = new Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  rol: { type: String, enum: ['estudiante', 'admin'], default: 'estudiante' },
  carrera: { type: String, default: null },
  intentosFallidos: { type: Number, default: 0, select: false },
  bloqueadoHasta: { type: Date, default: null, select: false },
  ultimoAcceso: { type: Date },
}, { timestamps: true });

UsuarioSchema.methods.publico = function publico() {
  return { id: this._id, nombre: this.nombre, email: this.email, rol: this.rol, carrera: this.carrera };
};

module.exports = model('Usuario', UsuarioSchema);
