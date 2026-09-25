// Interfaz 3 · Panel de scraping
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Scraping() {
  const [carreras, setCarreras] = useState([]);
  const [fuentes, setFuentes] = useState([]);
  const [f, setF] = useState({ carrera: '', puesto: '', fuentes: [] });
  const [jobs, setJobs] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [msg, setMsg] = useState('');

  const cargarJobs = () => api('/scraping/jobs').then(setJobs).catch((e) => setMsg(e.message));
  const cargarOfertas = () => api(`/scraping/ofertas${filtro ? `?carrera=${encodeURIComponent(filtro)}` : ''}`).then(setOfertas).catch(() => {});

  useEffect(() => {
    api('/carreras').then((c) => { setCarreras(c); setF((x) => ({ ...x, carrera: c[0]?.nombre || '' })); });
    api('/scraping/fuentes').then((fs) => { setFuentes(fs); setF((x) => ({ ...x, fuentes: fs })); });
    cargarJobs();
  }, []);
  useEffect(() => { cargarOfertas(); }, [filtro]);

  // Mientras haya jobs en curso, se consulta su estado cada 3 segundos
  useEffect(() => {
    if (!jobs.some((j) => ['pendiente', 'ejecutando'].includes(j.estado))) return undefined;
    const t = setInterval(() => { cargarJobs(); cargarOfertas(); }, 3000);
    return () => clearInterval(t);
  }, [jobs]);

  const lanzar = async () => {
    try {
      await api('/scraping/jobs', { method: 'POST', body: { carrera: f.carrera, fuentes: f.fuentes, ...(f.puesto ? { puesto: f.puesto } : {}) } });
      setMsg('Scraping lanzado'); cargarJobs();
    } catch (e) { setMsg(e.message); }
  };
  const quitar = async (o) => { await api(`/scraping/ofertas/${o._id}`, { method: 'DELETE' }); cargarOfertas(); };
  const puestoDe = carreras.find((c) => c.nombre === f.carrera)?.puesto || '';

  return (
    <main className="wrap panel">
      <div className="saludo"><div><h1>Panel de scraping</h1><p>Extrae ofertas reales de Jooble Perú, Computrabajo y Bumeran, y calcula qué competencias piden las empresas.</p></div><span className="chip rol">Administrador</span></div>
      <div className="dos">
        <div className="card"><h2>Nuevo scraping</h2>
          <label>Carrera<select className="input" value={f.carrera} onChange={(e) => setF({ ...f, carrera: e.target.value })}>{carreras.map((c) => <option key={c._id}>{c.nombre}</option>)}</select></label>
          <label>Puesto a buscar<input className="input" value={f.puesto} placeholder={puestoDe} onChange={(e) => setF({ ...f, puesto: e.target.value })} /></label>
          <div className="checks">{fuentes.map((x) => <label key={x}><input type="checkbox" checked={f.fuentes.includes(x)} onChange={(e) => setF({ ...f, fuentes: e.target.checked ? [...f.fuentes, x] : f.fuentes.filter((y) => y !== x) })} /> {x}</label>)}</div>
          <button className="btn" onClick={lanzar} disabled={!f.carrera || !f.fuentes.length}>Lanzar scraping</button>
          {msg && <p className="nota">{msg}</p>}
          <p className="nota">También corre automáticamente según SCRAPING_CRON del servidor.</p>
        </div>
        <div className="card"><h2>Jobs recientes</h2>
          <div className="tabla-scroll"><table className="tabla"><thead><tr><th>Fecha</th><th>Carrera</th><th>Estado</th><th>Ofertas</th><th>Nuevas</th><th>Detalle por fuente</th></tr></thead>
            <tbody>{jobs.map((j) => <tr key={j._id}><td>{new Date(j.createdAt).toLocaleString('es-PE')}</td><td>{j.carrera}{j.programado && <small> (automático)</small>}</td>
              <td><span className={`estado ${j.estado}`}>{j.estado}</span></td><td>{j.totalOfertas}</td><td>{j.nuevas}</td>
              <td className="detalle">{j.resultados.map((r) => `${r.fuente}: ${r.error ? `error (${r.error.slice(0, 40)})` : r.encontradas}`).join(' · ')}</td></tr>)}</tbody></table></div>
        </div>
      </div>
      <div className="card"><h2>Ofertas extraídas<small>{ofertas.length}</small></h2>
        <select className="input corto-sel" value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="">Todas las carreras</option>{carreras.map((c) => <option key={c._id}>{c.nombre}</option>)}</select>
        <div className="tabla-scroll"><table className="tabla"><thead><tr><th>Oferta</th><th>Empresa</th><th>Carrera</th><th>Competencias detectadas</th><th>Fuente</th><th /></tr></thead>
          <tbody>{ofertas.map((o) => <tr key={o._id}><td><a href={o.url} target="_blank" rel="noopener noreferrer">{o.titulo}</a></td><td>{o.empresa}</td><td>{o.carrera}</td>
            <td>{o.competencias.join(', ') || '—'}</td><td><span className="fuente">{o.fuente}</span></td><td><button className="x" aria-label="Quitar" onClick={() => quitar(o)}>×</button></td></tr>)}</tbody></table></div>
      </div>
    </main>
  );
}
