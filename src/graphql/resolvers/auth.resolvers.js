// Autenticación (Sequelize ORM)
const authService = require('../../services/auth.service');
const { User } = require('../../models/orm');
const { auth: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  User: {
    emailVerified: (user) => Boolean(user.emailVerifiedAt),
  },
  Query: {
    me: async (_, __, ctx) => User.findByPk(requireUser(ctx).id),
  },
  Mutation: {
    requestPasswordReset: async (_, args) => {
      const { email } = validateArgs(schemas.requestPasswordResetArgs, args);
      await authService.requestPasswordReset(email);
      return { ok: true, message: 'Si el correo está registrado, recibirás un código para restablecer tu contraseña' };
    },
    resetPassword: async (_, args) => {
      await authService.resetPassword(validateArgs(schemas.resetPasswordArgs, args));
      return { ok: true, message: 'Contraseña actualizada; inicia sesión con la nueva' };
    },
    refreshToken: async (_, args) => {
      const { refreshToken } = validateArgs(schemas.refreshTokenArgs, args);
      return authService.refreshSession(refreshToken);
    },
    logout: async (_, args, ctx) => {
      const user = requireUser(ctx);
      await authService.logout(user, validateArgs(schemas.logoutArgs, args));
      return { ok: true, message: 'Sesión cerrada' };
    },
    verifyEmail: async (_, args) => {
      const { token } = validateArgs(schemas.verifyEmailArgs, args);
      return authService.verifyEmail(token);
    },
    sendVerificationEmail: async (_, __, ctx) => {
      const user = await User.findByPk(requireUser(ctx).id);
      await authService.sendVerificationEmail(user);
      return { ok: true, message: `Te enviamos un enlace de confirmación a ${user.email}` };
    },
  },
};
