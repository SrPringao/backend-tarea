// Autenticación y perfil (Sequelize ORM)
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ok, noContent } = require('../utils/response');
const { sequelize, User, UserPreference } = require('../models/orm');

function buildSession(user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.expiresIn,
  });
  return { token, tokenType: 'Bearer', expiresIn: config.jwt.expiresIn, user: user.toJSON() };
}

async function emailTaken(email, exceptId) {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  return Boolean(user && user.id !== exceptId);
}

async function register(req, res) {
  const { email, password, displayName } = req.validated.body;
  if (await emailTaken(email)) throw ApiError.conflict('Ya existe una cuenta con ese correo');

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  // Usuario y sus preferencias se crean en la misma transacción
  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create({ email, displayName, passwordHash }, { transaction });
    await UserPreference.create({ userId: created.id }, { transaction });
    return created;
  });

  return ok(res, buildSession(user), 201);
}

async function login(req, res) {
  const { email, password } = req.validated.body;
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });

  // Mismo mensaje si el correo no existe o la contraseña es incorrecta (no revela cuentas)
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw ApiError.unauthorized('Correo o contraseña incorrectos');
  if (!user.isActive) throw ApiError.forbidden('Tu cuenta está desactivada, contacta al administrador');

  return ok(res, buildSession(user));
}

async function me(req, res) {
  const user = await User.findByPk(req.user.id, {
    include: [{ model: UserPreference, as: 'preferences' }],
  });
  return ok(res, user);
}

async function updateMe(req, res) {
  const { displayName, email } = req.validated.body;
  if (email && (await emailTaken(email, req.user.id))) {
    throw ApiError.conflict('Ese correo ya está registrado por otro usuario');
  }
  const user = await User.findByPk(req.user.id);
  await user.update({ displayName, email });
  return ok(res, user);
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated.body;
  const user = await User.unscoped().findByPk(req.user.id);

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('La contraseña actual es incorrecta');
  }

  await user.update({ passwordHash: await bcrypt.hash(newPassword, config.bcryptRounds) });
  return ok(res, { message: 'Contraseña actualizada' });
}

// Baja voluntaria: pide la contraseña y borra al usuario con toda su información (ON DELETE CASCADE)
async function deleteMe(req, res) {
  const { password } = req.validated.body;
  const user = await User.unscoped().findByPk(req.user.id);

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw ApiError.badRequest('La contraseña es incorrecta');
  }

  // El sistema no puede quedarse sin administradores activos
  if (user.role === 'admin') {
    const activeAdmins = await User.count({ where: { role: 'admin', isActive: true } });
    if (activeAdmins <= 1) {
      throw ApiError.badRequest('Eres el único administrador activo; asigna otro antes de eliminar tu cuenta');
    }
  }

  await user.destroy();
  return noContent(res);
}

module.exports = { register, login, me, updateMe, changePassword, deleteMe };
