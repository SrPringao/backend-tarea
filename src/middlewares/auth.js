const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../services/auth.service');

// Verifica el JWT (firma, expiración, revocación) y que el usuario siga existiendo y activo
async function authenticate(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Falta el token de acceso (Authorization: Bearer <token>)');
  }

  req.user = await verifyAccessToken(token);
  next();
}

// Restringe la ruta a ciertos roles. Usar despues de authenticate.
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden('Esta operación requiere rol de administrador');
    }
    next();
  };
}

module.exports = { authenticate, authorize };
