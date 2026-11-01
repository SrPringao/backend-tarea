// Reglas de acceso y validación para los resolvers (equivalen a authenticate, authorize y validate de REST)
const ApiError = require('../utils/ApiError');

function requireUser(ctx) {
  if (ctx.authError) throw ctx.authError;
  if (!ctx.user) throw ApiError.unauthorized('Falta el token de acceso (Authorization: Bearer <token>)');
  return ctx.user;
}

function requireAdmin(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'admin') throw ApiError.forbidden('Esta operación requiere rol de administrador');
  return user;
}

function requireApiKey(ctx) {
  if (ctx.apiKeyError) throw ctx.apiKeyError;
  if (!ctx.apiUser) throw ApiError.unauthorized('Falta el token de API (cabecera X-API-Key)');
  return ctx.apiUser;
}

// Valida los argumentos con Joi; devuelve los valores limpios (tipos convertidos, campos extra eliminados)
function validateArgs(schema, args) {
  const { value, error } = schema.validate(args, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    throw ApiError.badRequest(
      'Datos inválidos',
      error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))
    );
  }
  return value;
}

module.exports = { requireUser, requireAdmin, requireApiKey, validateArgs };
