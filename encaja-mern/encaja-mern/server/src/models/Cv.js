const { Schema, model, Types } = require('mongoose');

const CvSchema = new Schema({
  usuario: { type: Types.ObjectId, ref: 'Usuario', required: true, unique: true },
  nombreArchivo: { type: String, default: '' },
  texto: { type: String, required: true, maxlength: 60000 },
}, { timestamps: true });

module.exports = model('Cv', CvSchema);
