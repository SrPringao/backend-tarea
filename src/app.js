const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const config = require('./config/env');
const { sequelize, query } = require('./config/database');
const routes = require('./routes');
const openapi = require('./docs/openapi');
const { globalLimiter } = require('./middlewares/rateLimit');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Documentación interactiva (antes de helmet: Swagger UI necesita sus propios scripts y estilos)
app.get('/api-docs.json', (req, res) => res.json(openapi));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'API Finanzas Personales' }));

// Seguridad: cabeceras HTTP, CORS, límite de tamaño y de peticiones por IP
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '100kb' }));
if (!config.isTest) app.use(morgan('dev'));
app.use(globalLimiter);

app.get('/', (req, res) => {
  res.json({ ok: true, data: { name: 'API Finanzas Personales', version: '1.0.0', docs: '/api-docs', health: '/api/health' } });
});

// Verifica las dos vías de acceso a datos
app.get('/api/health', async (req, res) => {
  await Promise.all([sequelize.authenticate(), query('SELECT 1')]);
  res.json({ ok: true, data: { status: 'up', database: 'up', time: new Date().toISOString() } });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
