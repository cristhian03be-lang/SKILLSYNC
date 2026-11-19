# SKILLSYNC · Encaja

Plataforma web (stack MERN) que le muestra a un estudiante o egresado **qué competencias le faltan** para entrar a un puesto de entrada, comparando su perfil y su CV con lo que piden las ofertas reales del mercado laboral peruano.

## En línea

| Parte | URL |
|---|---|
| Web (React) | https://encaja-web-mw4n.onrender.com |
| API (Express) | https://encaja-api.onrender.com/api/salud |

> Plan gratis de Render: el servidor se duerme tras 15 min sin uso y tarda ~1 min en despertar. La API usa MongoDB embebido, así que los usuarios de prueba se reinician cuando el servidor se reinicia (las carreras, el administrador y las ofertas de muestra se cargan solos al iniciar).

## Tres interfaces

| Interfaz | Ruta | Para quién |
|---|---|---|
| Portal del usuario | `/` | Estudiantes y egresados: carrera, % de encaje, ruta de aprendizaje, CV |
| Panel administrativo | `/admin` | Administradores: métricas, carreras, usuarios, auditoría |
| Panel de scraping | `/scraping` | Administradores: ofertas de Jooble, Computrabajo y Bumeran |

## Estructura

```
.
├── encaja-mern/encaja-mern/
│   ├── server/   API Express + Mongoose + scraping (detalle en su README)
│   └── client/   React + Vite + React Router
├── .github/workflows/ci.yml   CI/CD
└── render.yaml                Blueprint de Render (API + frontend)
```

Cómo correrlo en local, la API, la matriz de riesgos → requisitos → pruebas y la cobertura están en [`encaja-mern/encaja-mern/README.md`](encaja-mern/encaja-mern/README.md).

## CI/CD

Cada push y pull request corre en GitHub Actions:

1. **secretos**: gitleaks revisa que no se suban credenciales.
2. **api**: 110 pruebas (unitarias, integración y seguridad) con cobertura mínima de **85 %**.
3. **cliente**: build de React.
4. **despliegue-produccion** (solo en `main` y si todo lo anterior pasó): dispara el deploy hook de Render y verifica que `/api/salud` responda.

Secretos del repositorio usados por el pipeline: `RENDER_DEPLOY_HOOK_URL` y `PROD_API_URL`.

## Despliegue (Render)

`render.yaml` crea dos servicios:

- **encaja-api**: Node 20, `npm start`. Con `MONGO_EMBEBIDO=true` levanta su propio MongoDB y corre el seed. Para datos permanentes, quitar esa variable y definir `MONGO_URI` (por ejemplo MongoDB Atlas).
- **encaja-web**: sitio estático (Vite) con rewrite a `index.html` para React Router.

`JWT_SECRET` y `ADMIN_PASSWORD` los genera Render y viven solo en su panel (Environment), nunca en el repositorio.

## Equipo

Proyecto del curso Desarrollo de Software Seguro, UPC.
