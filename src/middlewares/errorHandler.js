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

  const pgCode = err.code || err.parent?.code;

  if (err instanceof ApiError) {
    ({ status, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'El cuerpo de la petición no es un JSON válido';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'El cuerpo de la petición es demasiado grande';
  } else if (err.name === 'SequelizeValidationError') {
    status = 400;
    message = 'Datos inválidos';
    details = err.errors.map((e) => ({ field: e.path, message: e.message }));
  } else if (pgCode === '23505') {
    status = 409;
    message = 'Ya existe un registro con esos datos';
  } else if (pgCode === '23503' || pgCode === '23001') {
    status = 409;
    message = 'No se puede completar la operación porque el registro tiene datos relacionados';
  } else if (pgCode === '23514' || pgCode === '22P02' || pgCode === '22007' || pgCode === '22008') {
    status = 400;
    message = 'Algún valor no cumple las reglas de la base de datos';
  }

  if (status === 500) console.error('[ERROR]', err);

  const body = { ok: false, error: { status, message } };
  if (details) body.error.details = details;
  if (status === 500 && !config.isProd) body.error.debug = err.message;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
