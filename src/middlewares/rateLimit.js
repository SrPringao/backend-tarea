const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const baseOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
};

// Limite general por IP
const globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: { ok: false, error: { message: 'Demasiadas peticiones, intenta más tarde' } },
});

// Limite estricto para login/registro (fuerza bruta)
const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { ok: false, error: { message: 'Demasiados intentos de autenticación, espera 15 minutos' } },
});

// GraphQL: una sola URL concentra todas las operaciones, así que lleva su propio límite
const graphqlLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: { errors: [{ message: 'Demasiadas peticiones a GraphQL, intenta más tarde', extensions: { code: 'RATE_LIMITED' } }] },
});

// Envío de correos (notificaciones de admin): evita usar la API para mandar correo masivo
const mailLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: { ok: false, error: { message: 'Se alcanzó el límite de correos por hora' } },
});

module.exports = { globalLimiter, authLimiter, graphqlLimiter, mailLimiter };
