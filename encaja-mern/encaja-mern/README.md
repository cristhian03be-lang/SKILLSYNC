# Encaja · Stack MERN

**Problema:** desajuste entre las competencias del candidato y las competencias o requisitos que demanda el mercado laboral.
**Solución:** plataforma web (MongoDB · Express · React · Node.js) con tres interfaces:

| # | Interfaz | Ruta | Quién la usa | Qué hace |
|---|----------|------|--------------|----------|
| 1 | Portal del usuario (Encaja) | `/` | Estudiantes y egresados | Registro/login, elegir carrera, % de encaje, ruta de aprendizaje (3 pasos), subir CV y ver qué le falta, ofertas reales, barómetro de demanda, recursos |
| 2 | Panel administrativo | `/admin` | Administradores | Dashboard de métricas, CRUD de carreras/competencias/recursos/videos, gestión de usuarios y roles, auditoría |
| 3 | Panel de scraping | `/scraping` | Administradores | Lanzar scraping por carrera y portal (Jooble Perú, Computrabajo, Bumeran), ver jobs y ofertas extraídas con las competencias detectadas |

```
encaja-mern/
├── server/   API Express + Mongoose + worker de scraping (Axios + Cheerio + node-cron)
├── client/   React + Vite + React Router (las 3 interfaces)
├── docker-compose.yml   MongoDB local
└── .github/workflows/ci.yml   gitleaks + pruebas con cobertura ≥ 85 % + build + despliegue a producción
```

## Cómo ejecutarlo

Requisitos: Node.js 20+ y MongoDB (local con Docker o MongoDB Atlas gratis).

```bash
# 1) Base de datos
docker compose up -d                 # o usa tu cadena de MongoDB Atlas en MONGO_URI

# 2) API
cd server
cp .env.example .env                 # edita JWT_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD
npm install
npm run seed                         # 19 carreras + administrador + ofertas reales de muestra
npm run dev                          # http://localhost:4000

# 3) Cliente (otra terminal)
cd client
cp .env.example .env
npm install
npm run dev                          # http://localhost:5173
```

Entra con el correo y la clave de `ADMIN_EMAIL` / `ADMIN_PASSWORD` para ver el panel administrativo y el de scraping. Crea otra cuenta desde la pantalla de acceso para usar el portal como estudiante.

Scraping manual por consola: `npm run scrape -- "Marketing"` (o sin argumento para todas las carreras). Automático: variable `SCRAPING_CRON` (por defecto todos los días a las 6:00).

## API

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | /api/auth/registro · /api/auth/login | público | Cuenta y sesión (JWT 7 días) |
| GET | /api/carreras · /api/ofertas · /api/demanda | público | Catálogo, ofertas y % de demanda |
| PUT | /api/me/carrera · /api/me/progreso | estudiante | Carrera y pasos de la ruta |
| GET/PUT/DELETE | /api/me/cv · GET /api/me/cv/:id | dueño | CV (solo su dueño) |
| GET | /api/me/analisis | estudiante | CV vs. lo que piden las empresas |
| DELETE | /api/me/cuenta | estudiante | Eliminar cuenta y datos |
| CRUD | /api/admin/carreras · /api/admin/usuarios | admin | Catálogo y usuarios |
| GET | /api/admin/metricas · /api/admin/auditoria | admin | Dashboard y auditoría |
| POST/GET | /api/scraping/jobs · /api/scraping/ofertas | admin | Scraping |

## Seguridad: de la matriz de riesgos al código

| Riesgo | Requisito | Dónde está | Prueba |
|---|---|---|---|
| R1 Fuerza bruta en `POST /api/auth/login` | REQ-01 bloqueo 15 min tras 5 fallos (423) | `routes/auth.js`, `config.js` | TEST-01 |
| R2 Inyección NoSQL en la colección `usuarios` | REQ-02 validación con esquema (zod) + `express-mongo-sanitize` → 400 | `middleware/validar.js`, `app.js` | TEST-02 |
| R3 IDOR sobre el CV (`/api/me/cv/:id`) | REQ-03 solo el dueño (403) y token vigente (401) | `routes/me.js`, `middleware/auth.js` | TEST-03 |
| R4 Escalada de privilegios en `/api/admin/*` | REQ-04 `requireRole('admin')` → 403 | `middleware/auth.js`, `routes/admin.js`, `routes/scraping.js` | TEST-04 |
| R5 Secretos (.env) en GitHub | REQ-05 secretos solo en variables de entorno + gitleaks en CI | `config.js`, `.gitignore`, `.github/workflows/ci.yml` | pipeline |
| R6 XSS desde una oferta extraída | REQ-06 `sanitize-html` en el scraper + React renderiza texto | `services/scraper/util.js` | TEST-05 |

Además: contraseñas con bcrypt (12 rondas), `helmet`, CORS restringido a `CLIENT_ORIGIN`, límite de peticiones en `/api/auth`, errores sin trazas internas y auditoría de logins, bloqueos y acciones de administración.

## Pruebas

```bash
cd server
npm test                 # solo pruebas
npm run test:coverage    # pruebas + cobertura (falla si alguna métrica < 85 %)
```
- `tests/unit.test.js`: detección de competencias, parsers de los 3 portales con HTML de ejemplo y TEST-05 (XSS).
- `tests/seguridad.test.js`: TEST-01 a TEST-04 contra la API con MongoDB en memoria (`mongodb-memory-server` descarga MongoDB la primera vez).
- `tests/api.test.js`: integración de todas las rutas (auth, portal del usuario, públicas, admin y scraping), incluidos los errores 400/401/403/404/409/423/500.
- `tests/scraper.test.js`: runner de scraping, búsqueda por portal y cron diario, con `axios` simulado (no se llama a los portales reales).
- `tests/servicios.test.js`: cálculo de encaje, casos borde de competencias, utilidades, middlewares y configuración.

### Cobertura mínima: 85 %
La cobertura se mide sobre `server/src` (se excluyen solo los puntos de arranque por consola: `server.js`, `seed.js` y `scraper/cli.js`).
Jest exige **85 %** en líneas, sentencias, funciones y ramas (`coverageThreshold` en `server/package.json`). Si alguna queda por debajo:

1. `npm run test:coverage` termina con error y el job **api** del pipeline falla.
2. El paso *Puerta de calidad* publica la tabla de cobertura en el resumen de GitHub Actions con el veredicto.
3. El job **despliegue-produccion** depende de `secretos`, `api` y `cliente`, así que **no se ejecuta**: nada llega a producción.

El reporte completo (HTML en `coverage/lcov-report/index.html`) se guarda como artefacto `cobertura-api` en cada ejecución.

## Despliegue a producción
React en Vercel · API y worker en Render · MongoDB Atlas. Define las variables de `.env.example` en cada servicio (nunca en el código).

El pipeline despliega solo en un `push` a `main` con todos los jobs en verde. Para activarlo, crea estos secretos en *Settings → Secrets and variables → Actions*:

| Secreto | Para qué |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Deploy hook del servicio de la API en Render |
| `VERCEL_DEPLOY_HOOK_URL` | Deploy hook del proyecto del frontend en Vercel |
| `PROD_API_URL` | URL pública de la API, para verificar `/api/salud` después del despliegue |

Sin esos secretos el job termina con un aviso y no despliega nada.

> El scraping respeta un volumen bajo (máx. 40 ofertas por portal y job, una vez al día) y es para fines académicos. Los portales cambian su HTML con frecuencia: si una fuente deja de devolver ofertas, el job lo muestra como error y se ajusta su parser en `services/scraper/fuentes.js`.
