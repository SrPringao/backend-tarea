const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { User } = require('../models/orm');

// Verifica el JWT y que el usuario siga existiendo y activo
async function authenticate(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Falta el token de acceso (Authorization: Bearer <token>)');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  } catch (error) {
    throw ApiError.unauthorized(error.name === 'TokenExpiredError' ? 'El token expiró, inicia sesión de nuevo' : 'Token inválido');
  }

  const user = await User.findByPk(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('El usuario no existe o está desactivado');
  }

  req.user = { id: user.id, role: user.role, email: user.email };
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
