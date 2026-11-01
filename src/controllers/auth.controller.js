// Autenticación y perfil (Sequelize ORM)
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ok, noContent } = require('../utils/response');
const { sequelize, User, UserPreference } = require('../models/orm');
const authService = require('../services/auth.service');
const mail = require('../services/mail');
const { escapeHtml } = require('../services/mail/templates');

const { buildSession } = authService;

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

  // El correo de confirmación no bloquea el registro: si falla, se puede reenviar después
  authService.sendVerificationEmail(user).catch((error) => console.error('[CORREO] Verificación no enviada:', error.message));

  return ok(res, await buildSession(user), 201);
}

async function login(req, res) {
  const { email, password } = req.validated.body;
  const user = await User.unscoped().findOne({ where: { email: email.toLowerCase() } });

  // Mismo mensaje si el correo no existe o la contraseña es incorrecta (no revela cuentas)
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw ApiError.unauthorized('Correo o contraseña incorrectos');
  if (!user.isActive) throw ApiError.forbidden('Tu cuenta está desactivada, contacta al administrador');

  return ok(res, await buildSession(user));
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
  mail.sendInBackground(user.email, 'passwordChanged', { name: user.displayName });
  return ok(res, { message: 'Contraseña actualizada' });
}

// Destino del enlace del correo de confirmación. Es un GET porque se abre desde el cliente de correo;
// responde HTML para que la persona vea el resultado en el navegador.
async function verifyEmailLink(req, res) {
  const page = (title, message, status) =>
    res
      .status(status)
      .type('html')
      .send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="background:#fff;padding:32px;border-radius:8px;max-width:420px;text-align:center"><h1 style="color:#1f4e79;font-size:22px">${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`);

  try {
    const user = await authService.verifyEmail(req.validated.query.token);
    return page('Correo confirmado', `Listo, ${user.displayName}. Tu correo quedó verificado; ya puedes volver a la app.`, 200);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return page('Enlace no válido', error.message, error.status);
  }
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

module.exports = { register, login, me, updateMe, changePassword, deleteMe, verifyEmailLink };
