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

module.exports = { globalLimiter, authLimiter };
