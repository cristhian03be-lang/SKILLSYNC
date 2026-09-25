// Parsers de cada portal. Reciben HTML y devuelven ofertas limpias.
// Los portales cambian su HTML con frecuencia: cada parser es "mejor esfuerzo" y está cubierto por pruebas con fixtures.
const cheerio = require('cheerio');
const { limpiar, slug, absoluta, descargar } = require('./util');

function parseJooble(html) {
  const $ = cheerio.load(html);
  const out = [];
  $("a[href*='/jdp/'], a[href*='/desc/']").each((_, a) => {
    const $a = $(a);
    const titulo = limpiar($a.text());
    if (!titulo || titulo.length < 4) return;
    const card = $a.closest('li, article').length ? $a.closest('li, article') : $a.parent().parent();
    const empresa = limpiar(card.find('[class*="ompany"], [data-test*="company"]').first().text());
    const resumen = limpiar(card.text()).replace(titulo, '').slice(0, 300);
    out.push({ titulo, empresa, resumen, lugar: '', url: absoluta($a.attr('href'), 'https://pe.jooble.org'), fuente: 'Jooble' });
  });
  return out;
}

function parseComputrabajo(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('article').each((_, art) => {
    const $art = $(art);
    const $t = $art.find('h2 a, a.js-o-link').first();
    const titulo = limpiar($t.text());
    if (!titulo) return;
    const empresa = limpiar($art.find('p a, .fc_base a').first().text());
    out.push({ titulo, empresa, resumen: limpiar($art.text()).replace(titulo, '').slice(0, 300), lugar: '',
      url: absoluta($t.attr('href'), 'https://pe.computrabajo.com'), fuente: 'Computrabajo' });
  });
  return out;
}

function parseBumeran(html) {
  const $ = cheerio.load(html);
  const out = [];
  $("a[href*='/empleos/']").each((_, a) => {
    const $a = $(a);
    const titulo = limpiar($a.find('h2, h3').first().text()) || limpiar($a.text()).slice(0, 90);
    if (!titulo || titulo.length < 4) return;
    out.push({ titulo, empresa: limpiar($a.find('h3').eq(1).text()), resumen: limpiar($a.text()).replace(titulo, '').slice(0, 300),
      lugar: '', url: absoluta($a.attr('href'), 'https://www.bumeran.com.pe'), fuente: 'Bumeran' });
  });
  return out;
}

const FUENTES = {
  Jooble: { url: (p, c) => `https://pe.jooble.org/trabajo-${slug(p)}/${encodeURIComponent(`${c}, ${c}`)}`, parse: parseJooble },
  Computrabajo: { url: (p, c) => `https://pe.computrabajo.com/trabajo-de-${slug(p)}-en-${slug(c)}`, parse: parseComputrabajo },
  Bumeran: { url: (p, c) => `https://www.bumeran.com.pe/en-${slug(c)}/empleos-busqueda-${slug(p)}.html`, parse: parseBumeran },
};

async function buscar(fuente, puesto, ciudad = 'Lima') {
  const f = FUENTES[fuente];
  if (!f) throw new Error(`Fuente desconocida: ${fuente}`);
  const html = await descargar(f.url(puesto, ciudad));
  return f.parse(html);
}

module.exports = { FUENTES, buscar, parseJooble, parseComputrabajo, parseBumeran };
