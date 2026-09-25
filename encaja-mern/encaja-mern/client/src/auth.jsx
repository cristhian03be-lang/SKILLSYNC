import { createContext, useContext, useEffect, useState } from 'react';
import { api, sesion } from './api.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(sesion.existe());

  useEffect(() => {
    if (!sesion.existe()) return;
    api('/auth/me').then((d) => setUsuario(d.usuario)).catch(() => sesion.borrar()).finally(() => setCargando(false));
  }, []);

  const entrar = async (ruta, datos) => {
    const d = await api(ruta, { method: 'POST', body: datos });
    sesion.guardar(d.token);
    setUsuario(d.usuario);
    return d.usuario;
  };

  const valor = {
    usuario, cargando, setUsuario,
    login: (email, password) => entrar('/auth/login', { email, password }),
    registro: (nombre, email, password) => entrar('/auth/registro', { nombre, email, password }),
    salir: () => { sesion.borrar(); setUsuario(null); },
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
