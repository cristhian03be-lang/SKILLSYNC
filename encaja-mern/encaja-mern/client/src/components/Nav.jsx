import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Nav() {
  const { usuario, salir } = useAuth();
  const nav = useNavigate();
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <NavLink to="/" className="logo"><i>E</i>Encaja</NavLink>
        {usuario && (
          <nav className="links">
            <NavLink to="/" end>Portal</NavLink>
            {usuario.rol === 'admin' && <NavLink to="/admin">Panel administrativo</NavLink>}
            {usuario.rol === 'admin' && <NavLink to="/scraping">Scraping</NavLink>}
            <span className="quien">{usuario.nombre}</span>
            <button className="btn ghost sm" onClick={() => { salir(); nav('/acceso'); }}>Salir</button>
          </nav>
        )}
      </div>
    </header>
  );
}
