const ApiError = require('../utils/ApiError');
const config = require('../config/env');

function notFound(req, res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// Traduce errores de Express, Sequelize y PostgreSQL a respuestas JSON consistentes
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Error interno del servidor';
  let details;

  const known = ApiError.fromDatabase(err);

  if (known) {
    ({ status, message, details } = known);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'El cuerpo de la petición no es un JSON válido';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'El cuerpo de la petición es demasiado grande';
  }

  if (status === 500) console.error('[ERROR]', err);

  const body = { ok: false, error: { status, message } };
  if (details) body.error.details = details;
  if (status === 500 && !config.isProd) body.error.debug = err.message;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
