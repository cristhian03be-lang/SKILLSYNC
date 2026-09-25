import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Nav from './components/Nav.jsx';
import Acceso from './pages/Acceso.jsx';
import Portal from './pages/Portal.jsx';
import Admin from './pages/admin/Admin.jsx';
import Scraping from './pages/Scraping.jsx';

function Protegida({ rol, children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <p className="wrap vacio">Cargando…</p>;
  if (!usuario) return <Navigate to="/acceso" replace />;
  if (rol && usuario.rol !== rol) return <div className="wrap"><div className="card"><h2>Sin permiso</h2><p className="vacio">Esta sección es solo para administradores.</p></div></div>;
  return children;
}

export default function App() {
  const { usuario } = useAuth();
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/acceso" element={usuario ? <Navigate to={usuario.rol === 'admin' ? '/admin' : '/'} replace /> : <Acceso />} />
        <Route path="/" element={<Protegida><Portal /></Protegida>} />
        <Route path="/admin" element={<Protegida rol="admin"><Admin /></Protegida>} />
        <Route path="/scraping" element={<Protegida rol="admin"><Scraping /></Protegida>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
