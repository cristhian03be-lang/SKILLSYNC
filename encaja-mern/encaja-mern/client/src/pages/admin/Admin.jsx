// Interfaz 2 · Panel administrativo: dashboard, CRUD de carreras, usuarios y auditoría
import { useEffect, useState } from 'react';
import { api } from '../../api.js';

function Barras({ datos }) {
  const max = Math.max(1, ...datos.map((d) => d.n));
  if (!datos.length) return <p className="vacio">Sin datos todavía.</p>;
  return <div className="barras">{datos.map((d) => <div key={d.nombre}><span>{d.nombre}</span><i><em style={{ width: `${(100 * d.n) / max}%` }} /></i><b>{d.n}</b></div>)}</div>;
}

function Dashboard() {
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/admin/metricas').then(setM).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!m) return <p className="vacio">Cargando métricas…</p>;
  const kpis = [['Estudiantes', m.totales.estudiantes], ['Con carrera', m.totales.conCarrera], ['Con CV', m.totales.conCv], ['Encaje promedio', `${m.encajePromedio}%`], ['Ofertas extraídas', m.totales.ofertas], ['Carreras', m.totales.carreras]];
  return (<>
    <div className="kpis">{kpis.map(([l, v]) => <div key={l} className="kpi"><b>{v}</b><span>{l}</span></div>)}</div>
    <div className="dos">
      <div className="card"><h2>Carreras más elegidas</h2><Barras datos={m.carrerasMasElegidas} /></div>
      <div className="card"><h2>Competencias más pedidas en las ofertas</h2><Barras datos={m.competenciasMasPedidas} /></div>
      <div className="card"><h2>Ofertas por fuente</h2><Barras datos={m.ofertasPorFuente} /></div>
      <div className="card"><h2>Seguridad · últimos 7 días</h2>
        <div className="kpis mini-kpis"><div className="kpi"><b>{m.seguridad7dias.loginsOk}</b><span>Inicios de sesión</span></div><div className="kpi"><b>{m.seguridad7dias.loginsFallidos}</b><span>Intentos fallidos</span></div><div className="kpi alerta"><b>{m.seguridad7dias.bloqueos}</b><span>Cuentas bloqueadas</span></div></div>
      </div>
    </div>
  </>);
}

const vacia = { nombre: '', puesto: '', icono: '🎓', competencias: [{ nombre: '', peso: 60, recurso: '', video: '' }] };

function Carreras() {
  const [lista, setLista] = useState([]);
  const [sel, setSel] = useState(null);
  const [f, setF] = useState(vacia);
  const [msg, setMsg] = useState('');
  const cargar = () => api('/carreras').then(setLista).catch((e) => setMsg(e.message));
  useEffect(() => { cargar(); }, []);

  const abrir = (c) => { setSel(c?._id || 'nueva'); setF(c ? { nombre: c.nombre, puesto: c.puesto, icono: c.icono, competencias: c.competencias.map((x) => ({ video: '', ...x })) } : vacia); setMsg(''); };
  const setComp = (i, k, v) => setF({ ...f, competencias: f.competencias.map((c, j) => (j === i ? { ...c, [k]: k === 'peso' ? Number(v) : v } : c)) });
  const guardar = async () => {
    try {
      const body = { ...f, competencias: f.competencias.filter((c) => c.nombre.trim()) };
      if (sel === 'nueva') await api('/admin/carreras', { method: 'POST', body }); else await api(`/admin/carreras/${sel}`, { method: 'PUT', body });
      setMsg('Guardado'); setSel(null); cargar();
    } catch (e) { setMsg(e.message); }
  };
  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar ${f.nombre}?`)) return;
    try { await api(`/admin/carreras/${sel}`, { method: 'DELETE' }); setSel(null); cargar(); } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="dos ancho-izq">
      <div className="card"><h2>Carreras<small>{lista.length}</small></h2>
        <div className="lista">{lista.map((c) => <button key={c._id} aria-pressed={sel === c._id} onClick={() => abrir(c)}>{c.icono} {c.nombre}<em>{c.competencias.length}</em></button>)}</div>
        <button className="btn sm" onClick={() => abrir(null)}>+ Nueva carrera</button>
      </div>
      <div className="card">
        {!sel ? <p className="vacio">Selecciona una carrera para editarla o crea una nueva.</p> : (<>
          <h2>{sel === 'nueva' ? 'Nueva carrera' : `Editar: ${f.nombre}`}</h2>
          <div className="fila"><label>Nombre<input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
            <label>Puesto de entrada<input className="input" value={f.puesto} onChange={(e) => setF({ ...f, puesto: e.target.value })} /></label>
            <label className="corto">Ícono<input className="input" value={f.icono} onChange={(e) => setF({ ...f, icono: e.target.value })} /></label></div>
          <div className="tabla-scroll"><table className="tabla"><thead><tr><th>Competencia</th><th>% vacantes</th><th>Recurso</th><th>Video (URL)</th><th /></tr></thead>
            <tbody>{f.competencias.map((c, i) => (
              <tr key={i}><td><input value={c.nombre} onChange={(e) => setComp(i, 'nombre', e.target.value)} /></td>
                <td><input type="number" min="1" max="100" value={c.peso} onChange={(e) => setComp(i, 'peso', e.target.value)} /></td>
                <td><input value={c.recurso} onChange={(e) => setComp(i, 'recurso', e.target.value)} /></td>
                <td><input value={c.video || ''} placeholder="https://youtu.be/…" onChange={(e) => setComp(i, 'video', e.target.value)} /></td>
                <td><button className="x" aria-label="Quitar" onClick={() => setF({ ...f, competencias: f.competencias.filter((_, j) => j !== i) })}>×</button></td></tr>))}</tbody></table></div>
          <div className="fila"><button className="btn ghost sm" onClick={() => setF({ ...f, competencias: [...f.competencias, { nombre: '', peso: 60, recurso: '', video: '' }] })}>+ Competencia</button>
            <button className="btn sm" onClick={guardar}>Guardar</button>
            {sel !== 'nueva' && <button className="btn peligro sm" onClick={eliminar}>Eliminar carrera</button>}</div>
        </>)}
        {msg && <p className="nota">{msg}</p>}
      </div>
    </div>
  );
}

function Usuarios() {
  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState('');
  const cargar = () => api('/admin/usuarios').then((d) => setLista(Array.isArray(d) ? d : [])).catch((e) => setMsg(e.message));
  useEffect(() => { cargar(); }, []);
  const rol = async (u, r) => { try { await api(`/admin/usuarios/${u.id}/rol`, { method: 'PATCH', body: { rol: r } }); cargar(); } catch (e) { setMsg(e.message); } };
  const borrar = async (u) => { if (!window.confirm(`¿Eliminar a ${u.email}?`)) return; try { await api(`/admin/usuarios/${u.id}`, { method: 'DELETE' }); cargar(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="card"><h2>Usuarios<small>{lista.length}</small></h2>{msg && <p className="error">{msg}</p>}
      <div className="tabla-scroll"><table className="tabla"><thead><tr><th>Nombre</th><th>Correo</th><th>Carrera</th><th>Encaje</th><th>CV</th><th>Rol</th><th /></tr></thead>
        <tbody>{lista.map((u) => (
          <tr key={u.id}><td>{u.nombre}</td><td>{u.email}</td><td>{u.carrera || '—'}</td><td><b>{u.encaje}%</b></td><td>{u.tieneCv ? 'Sí' : 'No'}</td>
            <td><select value={u.rol} onChange={(e) => rol(u, e.target.value)}><option value="estudiante">estudiante</option><option value="admin">admin</option></select></td>
            <td><button className="x" aria-label="Eliminar" onClick={() => borrar(u)}>×</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

function Auditoria() {
  const [lista, setLista] = useState([]);
  useEffect(() => { api('/admin/auditoria').then((d) => setLista(Array.isArray(d) ? d : [])).catch(() => {}); }, []);
  return (
    <div className="card"><h2>Auditoría<small>últimas 100 acciones</small></h2>
      <div className="tabla-scroll"><table className="tabla"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th><th>IP</th></tr></thead>
        <tbody>{lista.map((a) => <tr key={a._id}><td>{new Date(a.createdAt).toLocaleString('es-PE')}</td><td>{a.email}</td><td><span className={`accion ${a.accion}`}>{a.accion}</span></td><td>{a.detalle}</td><td>{a.ip}</td></tr>)}</tbody></table></div>
    </div>
  );
}

const TABS = [['dashboard', 'Dashboard', Dashboard], ['carreras', 'Carreras y competencias', Carreras], ['usuarios', 'Usuarios', Usuarios], ['auditoria', 'Auditoría', Auditoria]];

export default function Admin() {
  const [tab, setTab] = useState('dashboard');
  const Vista = TABS.find((t) => t[0] === tab)[2];
  return (
    <main className="wrap panel">
      <div className="saludo"><div><h1>Panel administrativo</h1><p>Gestiona el catálogo, los usuarios y revisa las métricas de Encaja.</p></div><span className="chip rol">Administrador</span></div>
      <div className="pestanas" role="tablist">{TABS.map(([id, t]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{t}</button>)}</div>
      <Vista />
    </main>
  );
}
