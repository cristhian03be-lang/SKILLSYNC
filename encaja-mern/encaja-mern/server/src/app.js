const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('./config');
const { manejarErrores } = require('./middleware/errores');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: false }));
app.use(express.json({ limit: '200kb' }));
app.use(mongoSanitize()); // REQ-02: elimina claves que empiezan con "$" o contienen "."

app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/me', require('./routes/me'));
app.use('/api', require('./routes/publico'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/scraping', require('./routes/scraping'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use(manejarErrores);

module.exports = app;
