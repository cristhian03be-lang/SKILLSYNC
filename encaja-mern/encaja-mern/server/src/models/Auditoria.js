const { Schema, model, Types } = require('mongoose');

const AuditoriaSchema = new Schema({
  usuario: { type: Types.ObjectId, ref: 'Usuario' },
  email: String,
  accion: { type: String, required: true }, // login_ok, login_fallido, cuenta_bloqueada, admin_*, scraping_*
  detalle: { type: String, default: '' },
  ip: String,
}, { timestamps: true });

module.exports = model('Auditoria', AuditoriaSchema);
