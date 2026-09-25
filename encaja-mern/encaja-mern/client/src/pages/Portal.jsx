// Interfaz 1 · Portal del usuario (Encaja)
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const PASOS = ['Aprender lo básico', 'Practicar con un caso real', 'Demostrarlo en tu portafolio'];
const recursos = (n) => [
  ['YouTube', `https://www.youtube.com/results?search_query=${encodeURIComponent(`curso ${n} desde cero`)}`],
  ['Coursera', `https://www.coursera.org/search?query=${encodeURIComponent(n)}&language=Spanish`],
  ['Udemy', `https://www.udemy.com/courses/search/?q=${encodeURIComponent(n)}&lang=es`],
];

function Anillo({ pct }) {
  const c = 2 * Math.PI * 60;
  return (
    <div className="anillo">
      <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden="true">
        <circle cx="70" cy="70" r="60" className="pista" />
        <circle cx="70" cy="70" r="60" className="relleno" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
      </svg>
      <div className="num"><b>{pct}%</b><small>listo para entrar</small></div>
    </div>
  );
}

export default function Portal() {
  const { usuario, setUsuario, salir } = useAuth();
  const [carreras, setCarreras] = useState([]);
  const [prog, setProg] = useState(null);
  const [ofertas, setOfertas] = useState([]);
  const [dem, setDem] = useState(null);
  const [cv, setCv] = useState({ texto: '', nombreArchivo: '' });
  const [analisis, setAnalisis] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2000); };
  const fallo = (e) => setError(e.message);

  useEffect(() => {
    api('/carreras').then(setCarreras).catch(fallo);
    api('/me/progreso').then(setProg).catch(fallo);
    api('/me/cv').then((d) => d.cv && setCv({ texto: d.cv.texto, nombreArchivo: d.cv.nombreArchivo })).catch(() => {});
  }, []);

  const carrera = usuario?.carrera;
  useEffect(() => {
    if (!carrera) return;
    const q = encodeURIComponent(carrera);
    api(`/ofertas?carrera=${q}`).then(setOfertas).catch(fallo);
    api(`/demanda?carrera=${q}`).then(setDem).catch(fallo);
    setAnalisis(null);
  }, [carrera]);

  const elegir = async (nombre) => {
    try { const d = await api('/me/carrera', { method: 'PUT', body: { carrera: nombre } }); setProg(d); setUsuario({ ...usuario, carrera: nombre }); } catch (e) { fallo(e); }
  };
  const marcar = async (competencia, paso, completado, enlace) => {
    try { setProg(await api('/me/progreso', { method: 'PUT', body: { competencia, paso, completado, ...(enlace !== undefined ? { enlace } : {}) } })); avisar('Avance guardado'); } catch (e) { fallo(e); }
  };
  const leerArchivo = async (file) => {
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) { setError('Por ahora sube tu CV como .txt o pega el texto (desde Word: Guardar como → Texto sin formato).'); return; }
    setCv({ texto: await file.text(), nombreArchivo: file.name });
  };
  const analizar = async () => {
    try {
      await api('/me/cv', { method: 'PUT', body: cv });
      setAnalisis(await api('/me/analisis'));
      setError('');
    } catch (e) { fallo(e); }
  };
  const marcarDetectadas = async () => {
    const nombres = analisis.tienes.filter((c) => c.enCatalogo).map((c) => c.nombre);
    try { for (const n of nombres) for (let i = 0; i < 3; i += 1) await api('/me/progreso', { method: 'PUT', body: { competencia: n, paso: i, completado: true } }); setProg(await api('/me/progreso')); avisar('Competencias marcadas'); } catch (e) { fallo(e); }
  };
  const eliminarCuenta = async () => {
    if (!window.confirm('¿Eliminar tu cuenta, tu CV y todo tu avance? No se puede deshacer.')) return;
    try { await api('/me/cuenta', { method: 'DELETE' }); salir(); } catch (e) { fallo(e); }
  };

  const encaje = prog?.encaje || { pct: 0, lista: [] };
  const faltan = encaje.lista.filter((x) => x.hechos < 3);
  const sig = faltan[0];

  return (
    <main className="wrap panel">
      <div className="saludo">
        <div><h1>Hola, {usuario.nombre}</h1><p>{prog?.carrera ? `Estudias ${prog.carrera.nombre}. Puesto de entrada: ${prog.carrera.puesto}.` : 'Elige tu carrera para empezar.'}</p></div>
        {aviso && <span className="chip ok">{aviso}</span>}
      </div>
      {error && <p className="error" onClick={() => setError('')}>{error}</p>}

      <div className="grid">
        <aside className="lateral">
          <div className="card">
            <h2>Tu encaje con el puesto</h2>
            <div className="encaje"><Anillo pct={encaje.pct} />
              <div className="stats">
                <div><span>Te falta</span><b>{100 - encaje.pct}%</b></div>
                <div><span>Competencias completas</span><b>{encaje.lista.filter((x) => x.hechos === 3).length} / {encaje.lista.length}</b></div>
              </div>
            </div>
          </div>
          {sig && (
            <div className="siguiente">
              <small>Siguiente paso recomendado</small>
              <strong>{sig.nombre}</strong>
              <p>{PASOS[sig.pasos.indexOf(false)]}: {sig.recurso}</p>
              <div className="recursos">{recursos(sig.nombre).map(([n, u]) => <a key={n} href={u} target="_blank" rel="noopener noreferrer">{n}</a>)}</div>
              <button className="btn claro sm" onClick={() => marcar(sig.nombre, sig.pasos.indexOf(false), true)}>Marcar como hecho</button>
            </div>
          )}
        </aside>

        <section>
          <div className="card">
            <h2>¿Qué estudias?</h2>
            <div className="carreras">
              {carreras.map((c) => (
                <button key={c._id} className="carrera" aria-pressed={carrera === c.nombre} onClick={() => elegir(c.nombre)}>
                  <span>{c.icono}</span><strong>{c.nombre}</strong><em>{c.puesto}</em>
                </button>
              ))}
            </div>
          </div>

          {prog?.carrera && (<>
            <div className="card">
              <h2>Ofertas reales para {prog.carrera.puesto}<small>{ofertas.length} ofertas</small></h2>
              {ofertas.length === 0 ? <p className="vacio">Aún no hay ofertas extraídas para esta carrera. El administrador puede lanzar el scraping.</p> : (
                <div className="ofertas">{ofertas.slice(0, 10).map((o) => (
                  <div className="oferta" key={o._id}>
                    <div><a href={o.url} target="_blank" rel="noopener noreferrer"><strong>{o.titulo}</strong></a>
                      <small>{[o.empresa, o.lugar, o.publicada].filter(Boolean).join(' · ')}</small></div>
                    <span className="fuente">{o.fuente}</span>
                  </div>))}</div>)}
            </div>

            {dem && (
              <div className="card">
                <h2>Barómetro de demanda<small>{dem.enVivo ? `${dem.totalOfertas} ofertas analizadas` : 'según el catálogo'}</small></h2>
                <div className="barometro">{dem.competencias.slice(0, 10).map((c) => (
                  <div key={c.nombre} className={c.enCatalogo ? '' : 'nuevo'}><span>{c.nombre}{!c.enCatalogo && <small> (nuevo en el mercado)</small>}</span><b>{c.pct}%</b><i><em style={{ width: `${c.pct}%` }} /></i></div>))}</div>
              </div>
            )}

            <div className="card">
              <h2>Tu CV<small>compáralo con lo que piden las empresas</small></h2>
              <input type="file" accept=".txt,.md" onChange={(e) => leerArchivo(e.target.files[0])} />
              <textarea className="input" rows={6} value={cv.texto} onChange={(e) => setCv({ ...cv, texto: e.target.value })} placeholder="Pega aquí el texto de tu CV: experiencia, cursos, herramientas, certificaciones…" />
              <div className="fila"><button className="btn sm" onClick={analizar} disabled={cv.texto.trim().length < 20}>Guardar y analizar</button>
                {cv.texto && <button className="btn ghost sm" onClick={async () => { await api('/me/cv', { method: 'DELETE' }); setCv({ texto: '', nombreArchivo: '' }); setAnalisis(null); }}>Quitar CV</button>}</div>
              {analisis && (
                <div className="analisis">
                  <h3>Cubres el {analisis.cobertura}% de lo que piden hoy las empresas</h3>
                  <div className="etiquetas">{analisis.tienes.map((c) => <span key={c.nombre} className="si">✓ {c.nombre} · {c.pct}%</span>)}</div>
                  <h3>Te falta</h3>
                  <div className="etiquetas">{analisis.faltan.map((c) => <span key={c.nombre} className="no">{c.nombre} · {c.pct}%</span>)}</div>
                  {analisis.tienes.some((c) => c.enCatalogo) && <button className="btn sm" onClick={marcarDetectadas}>Marcar las detectadas como dominadas</button>}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Tu ruta de aprendizaje</h2>
              <div className="ruta">{encaje.lista.map((it) => (
                <details key={it.nombre} className={`skill ${it.hechos === 3 ? 'hecho' : ''}`} open={it.hechos > 0 && it.hechos < 3}>
                  <summary><strong>{it.nombre}</strong><span className="mini"><em style={{ width: `${(it.hechos / 3) * 100}%` }} /></span><span className="pill">{it.hechos === 3 ? 'completado' : `${it.peso}% de vacantes`}</span></summary>
                  {PASOS.map((p, i) => (
                    <label key={p} className="paso"><input type="checkbox" checked={it.pasos[i]} onChange={(e) => marcar(it.nombre, i, e.target.checked)} />
                      <span>{i + 1}. {p}{i === 0 && <small>{it.recurso}</small>}</span></label>
                  ))}
                  <div className="fila"><input className="input" placeholder="Enlace a tu proyecto (GitHub, Behance, Drive)" defaultValue={it.enlace} onBlur={(e) => e.target.value !== it.enlace && marcar(it.nombre, 2, !!e.target.value || it.pasos[2], e.target.value)} /></div>
                </details>))}</div>
            </div>
          </>)}
          <p className="nota derecha"><button className="enlace" onClick={eliminarCuenta}>Eliminar mi cuenta y mis datos</button></p>
        </section>
      </div>
    </main>
  );
}
