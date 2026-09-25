const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const token = () => localStorage.getItem('encaja_token');

export async function api(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + ruta, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'No se pudo conectar con el servidor.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const sesion = {
  guardar: (t) => localStorage.setItem('encaja_token', t),
  borrar: () => localStorage.removeItem('encaja_token'),
  existe: () => !!token(),
};
