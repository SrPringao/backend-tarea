class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'No tienes permiso para realizar esta acción') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }
}

// Traduce errores conocidos de PostgreSQL y Sequelize a ApiError (sin exponer detalles internos).
// Lo usan el manejador de errores de REST y el enmascarado de errores de GraphQL.
ApiError.fromDatabase = function fromDatabase(err) {
  if (err instanceof ApiError) return err;
  if (err?.name === 'SequelizeValidationError') {
    return ApiError.badRequest(
      'Datos inválidos',
      err.errors.map((e) => ({ field: e.path, message: e.message }))
    );
  }
  const pgCode = err?.code || err?.parent?.code;
  if (pgCode === '23505') return ApiError.conflict('Ya existe un registro con esos datos');
  if (pgCode === '23503' || pgCode === '23001') {
    return ApiError.conflict('No se puede completar la operación porque el registro tiene datos relacionados');
  }
  if (['23514', '22P02', '22007', '22008', '22003'].includes(pgCode)) {
    return ApiError.badRequest('Algún valor no cumple las reglas de la base de datos');
  }
  return null;
};

module.exports = ApiError;
