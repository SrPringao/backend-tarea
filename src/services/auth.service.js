// Lógica de autenticación compartida por REST y GraphQL (Sequelize ORM).
// Tokens de un solo uso: el valor real solo viaja una vez (correo o respuesta) y en la base se guarda su hash.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const mail = require('./mail');
const { sequelize, User, AuthToken, RevokedToken } = require('../models/orm');

const VERIFY_HOURS = 24;
const RESET_MINUTES = 15;
const RESET_MAX_ATTEMPTS = 5;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const addMinutes = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

function issueAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.expiresIn,
    jwtid: crypto.randomUUID(),
  });
}

async function issueRefreshToken(userId, transaction) {
  const token = randomToken();
  await AuthToken.create(
    { userId, purpose: 'refresh', tokenHash: sha256(token), expiresAt: addMinutes(config.jwt.refreshDays * 24 * 60) },
    { transaction }
  );
  return token;
}

async function buildSession(user, transaction) {
  return {
    token: issueAccessToken(user),
    tokenType: 'Bearer',
    expiresIn: config.jwt.expiresIn,
    refreshToken: await issueRefreshToken(user.id, transaction),
    user: user.toJSON(),
  };
}

// Verifica un JWT de acceso: firma, expiración, revocación (logout) y que el usuario siga activo
async function verifyAccessToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  } catch (error) {
    throw ApiError.unauthorized(error.name === 'TokenExpiredError' ? 'El token expiró, inicia sesión de nuevo' : 'Token inválido');
  }

  if (payload.jti && (await RevokedToken.findByPk(payload.jti))) {
    throw ApiError.unauthorized('La sesión se cerró, inicia sesión de nuevo');
  }

  const user = await User.findByPk(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('El usuario no existe o está desactivado');

  return { id: user.id, role: user.role, email: user.email, jti: payload.jti, exp: payload.exp };
}

// Invalida los tokens pendientes de un propósito (solo el más reciente queda vigente)
async function invalidatePending(userId, purpose, transaction) {
  await AuthToken.update({ usedAt: new Date() }, { where: { userId, purpose, usedAt: null }, transaction });
}

// ----- Verificación de correo (OP-010) -----

async function sendVerificationEmail(user) {
  if (user.emailVerifiedAt) throw ApiError.conflict('Tu correo ya está verificado');
  const token = randomToken();
  await sequelize.transaction(async (transaction) => {
    await invalidatePending(user.id, 'verify_email', transaction);
    await AuthToken.create(
      { userId: user.id, purpose: 'verify_email', tokenHash: sha256(token), expiresAt: addMinutes(VERIFY_HOURS * 60) },
      { transaction }
    );
  });
  await mail.send(user.email, 'verifyEmail', { name: user.displayName, token });
}

async function verifyEmail(token) {
  const record = await AuthToken.findOne({
    where: { purpose: 'verify_email', tokenHash: sha256(String(token)), usedAt: null, expiresAt: { [Op.gt]: new Date() } },
  });
  if (!record) throw ApiError.badRequest('El enlace de verificación no es válido o ya venció');

  const user = await User.findByPk(record.userId);
  await sequelize.transaction(async (transaction) => {
    await record.update({ usedAt: new Date() }, { transaction });
    if (!user.emailVerifiedAt) await user.update({ emailVerifiedAt: new Date() }, { transaction });
  });
  return user;
}

// ----- Recuperación de contraseña (OP-006 y OP-007) -----

// Siempre termina igual exista o no el correo, para no revelar qué cuentas existen
async function requestPasswordReset(email) {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) return;

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await sequelize.transaction(async (transaction) => {
    await invalidatePending(user.id, 'reset_password', transaction);
    // El hash incluye el id del usuario: el mismo código en dos usuarios no choca con la llave única
    await AuthToken.create(
      { userId: user.id, purpose: 'reset_password', tokenHash: sha256(`${user.id}:${code}`), expiresAt: addMinutes(RESET_MINUTES) },
      { transaction }
    );
  });
  await mail.send(user.email, 'passwordResetCode', { name: user.displayName, code });
}

async function resetPassword({ email, code, newPassword }) {
  const invalid = ApiError.badRequest('El código no es válido o ya venció');
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) throw invalid;

  const record = await AuthToken.findOne({
    where: { userId: user.id, purpose: 'reset_password', usedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });
  if (!record || record.attempts >= RESET_MAX_ATTEMPTS) throw invalid;

  const expected = Buffer.from(record.tokenHash);
  const received = Buffer.from(sha256(`${user.id}:${code}`));
  if (!crypto.timingSafeEqual(expected, received)) {
    await record.increment('attempts');
    throw invalid;
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await sequelize.transaction(async (transaction) => {
    await record.update({ usedAt: new Date() }, { transaction });
    await user.update({ passwordHash }, { transaction });
    // Cierra las sesiones abiertas en otros dispositivos
    await invalidatePending(user.id, 'refresh', transaction);
  });
  mail.sendInBackground(user.email, 'passwordChanged', { name: user.displayName });
}

// ----- Refresh token (OP-008) y cierre de sesión (OP-009) -----

async function refreshSession(refreshToken) {
  const record = await AuthToken.findOne({ where: { purpose: 'refresh', tokenHash: sha256(String(refreshToken)) } });
  if (!record || record.expiresAt <= new Date()) throw ApiError.unauthorized('El refresh token no es válido o ya venció');

  // Reutilizar un refresh token ya usado indica que pudo ser robado: se cierran todas las sesiones
  if (record.usedAt) {
    await invalidatePending(record.userId, 'refresh');
    throw ApiError.unauthorized('El refresh token ya fue utilizado; por seguridad se cerraron todas tus sesiones');
  }

  const user = await User.findByPk(record.userId);
  if (!user || !user.isActive) throw ApiError.unauthorized('El usuario no existe o está desactivado');

  return sequelize.transaction(async (transaction) => {
    await record.update({ usedAt: new Date() }, { transaction });
    return buildSession(user, transaction);
  });
}

async function logout(authUser, { refreshToken, allDevices = false } = {}) {
  await sequelize.transaction(async (transaction) => {
    if (authUser.jti) {
      await RevokedToken.findOrCreate({
        where: { jti: authUser.jti },
        defaults: { userId: authUser.id, expiresAt: new Date(authUser.exp * 1000) },
        transaction,
      });
    }
    if (allDevices) {
      await invalidatePending(authUser.id, 'refresh', transaction);
    } else if (refreshToken) {
      await AuthToken.update(
        { usedAt: new Date() },
        { where: { userId: authUser.id, purpose: 'refresh', tokenHash: sha256(String(refreshToken)), usedAt: null }, transaction }
      );
    }
  });
}

module.exports = {
  sha256,
  randomToken,
  buildSession,
  verifyAccessToken,
  sendVerificationEmail,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  refreshSession,
  logout,
};
