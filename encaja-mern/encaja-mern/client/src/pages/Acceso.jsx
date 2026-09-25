import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Acceso() {
  const { login, registro } = useAuth();
  const nav = useNavigate();
  const [modo, setModo] = useState('entrar');
  const [f, setF] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const u = modo === 'entrar' ? await login(f.email, f.password) : await registro(f.nombre, f.email, f.password);
      nav(u.rol === 'admin' ? '/admin' : '/');
    } catch (err) { setError(err.message); }
    setCargando(false);
  };

  return (
    <main className="wrap acceso">
      <section className="hero">
        <h1>¿Qué te falta para entrar al mercado laboral?</h1>
        <p>Elige lo que estudias, sube tu CV y descubre qué competencias piden hoy las empresas en el Perú. Sigue una ruta de aprendizaje y mira cómo sube tu porcentaje.</p>
      </section>
      <form className="card form" onSubmit={enviar}>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={modo === 'entrar'} onClick={() => setModo('entrar')}>Iniciar sesión</button>
          <button type="button" role="tab" aria-selected={modo === 'registro'} onClick={() => setModo('registro')}>Crear cuenta</button>
        </div>
        {modo === 'registro' && (<label>Nombre<input className="input" value={f.nombre} onChange={cambiar('nombre')} required minLength={2} /></label>)}
        <label>Correo<input className="input" type="email" value={f.email} onChange={cambiar('email')} required autoComplete="username" /></label>
        <label>Contraseña<input className="input" type="password" value={f.password} onChange={cambiar('password')} required minLength={modo === 'registro' ? 8 : 1} autoComplete={modo === 'registro' ? 'new-password' : 'current-password'} /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={cargando}>{cargando ? 'Cargando…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>
        <p className="nota">Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.</p>
      </form>
    </main>
  );
}
