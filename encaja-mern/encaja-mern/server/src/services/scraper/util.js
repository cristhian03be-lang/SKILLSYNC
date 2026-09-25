const sanitizeHtml = require('sanitize-html');
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EncajaBot/1.0 (proyecto universitario UPC)';

// REQ-06: todo texto extraído se limpia a texto plano (sin etiquetas ni atributos como onerror)
const limpiar = (t) => sanitizeHtml(String(t || ''), { allowedTags: [], allowedAttributes: {} })
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const slug = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const absoluta = (href, base) => {
  if (!href) return '';
  try { return new URL(href, base).toString(); } catch { return ''; }
};

async function descargar(url) {
  const r = await axios.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-PE,es;q=0.9' }, timeout: 15000 });
  return r.data;
}

module.exports = { limpiar, slug, absoluta, descargar };
