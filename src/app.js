const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const config = require('./config/env');
const { sequelize, query } = require('./config/database');
const routes = require('./routes');
const openapi = require('./docs/openapi');
const { yoga } = require('./graphql');
const { globalLimiter, graphqlLimiter } = require('./middlewares/rateLimit');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Detrás de un proxy (Render, Railway, Nginx) la IP real llega en X-Forwarded-For; necesario para el rate limit
if (config.isProd) app.set('trust proxy', 1);

// Documentación interactiva (antes de helmet: Swagger UI necesita sus propios scripts y estilos)
app.get('/api-docs.json', (req, res) => res.json(openapi));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'API Finanzas Personales' }));

// Seguridad: cabeceras HTTP. GraphiQL (solo en desarrollo) carga sus scripts desde unpkg, por eso /graphql
// tiene una política de contenido propia; el resto de la API usa la política estricta de helmet.
const strictHelmet = helmet();
const graphqlHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      imgSrc: ["'self'", 'data:', 'https://raw.githubusercontent.com'],
      fontSrc: ["'self'", 'data:', 'https://unpkg.com'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
    },
  },
});
app.use((req, res, next) => (req.path.startsWith('/graphql') ? graphqlHelmet : strictHelmet)(req, res, next));

app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);
app.use(express.json({ limit: '100kb' }));
if (!config.isTest) app.use(morgan('dev'));
app.use(globalLimiter);

// Las respuestas con tokens o datos personales no deben quedar en cachés intermedias
app.use(['/api', '/graphql'], (req, res, next) => {
  if (!req.path.startsWith('/files')) res.set('Cache-Control', 'no-store');
  next();
});

app.get('/', (req, res) => {
  res.json({
    ok: true,
    data: { name: 'API Finanzas Personales', version: '2.0.0', rest: '/api', docs: '/api-docs', graphql: '/graphql', health: '/api/health' },
  });
});

// Verifica las dos vías de acceso a datos
app.get('/api/health', async (req, res) => {
  await Promise.all([sequelize.authenticate(), query('SELECT 1')]);
  res.json({ ok: true, data: { status: 'up', database: 'up', time: new Date().toISOString() } });
});

// GraphQL. Las subidas (multipart) deben declarar su tamaño y no pasar de 3 MB; cada archivo además
// se limita a 2 MB al guardarlo. Las peticiones JSON ya quedaron limitadas a 100 KB por express.json.
const MAX_MULTIPART_BYTES = 3 * 1024 * 1024;
app.use(yoga.graphqlEndpoint, graphqlLimiter, (req, res, next) => {
  if (!req.is('multipart/form-data')) return next();
  const length = Number(req.get('content-length'));
  if (!length) return res.status(411).json({ errors: [{ message: 'Las subidas deben indicar Content-Length' }] });
  if (length > MAX_MULTIPART_BYTES) return res.status(413).json({ errors: [{ message: 'La subida supera el máximo de 3 MB' }] });
  return next();
});
app.use(yoga.graphqlEndpoint, yoga);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
