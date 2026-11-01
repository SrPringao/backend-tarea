const { Joi, password, trimmed } = require('./common');

const email = Joi.string().trim().email().max(160);

const auth = {
  register: {
    body: Joi.object({
      email: Joi.string().trim().email().max(160).required(),
      password: password.required(),
      displayName: trimmed(80).required(),
    }),
  },
  login: {
    body: Joi.object({
      email: Joi.string().trim().email().required(),
      password: Joi.string().required(),
    }),
  },
  updateMe: {
    body: Joi.object({
      displayName: trimmed(80),
      email: Joi.string().trim().email().max(160),
    }).min(1),
  },
  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: password.required().invalid(Joi.ref('currentPassword')).messages({
        'any.invalid': 'newPassword debe ser distinta a la contraseña actual',
      }),
    }),
  },
  verifyEmailLink: {
    query: Joi.object({ token: Joi.string().max(200).required() }),
  },
  // Argumentos de las operaciones GraphQL (etapa 2)
  requestPasswordResetArgs: Joi.object({ email: email.required() }),
  resetPasswordArgs: Joi.object({
    email: email.required(),
    code: Joi.string().pattern(/^\d{6}$/, '6 dígitos').required(),
    newPassword: password.required(),
  }),
  refreshTokenArgs: Joi.object({ refreshToken: Joi.string().max(200).required() }),
  logoutArgs: Joi.object({ refreshToken: Joi.string().max(200), allDevices: Joi.boolean().default(false) }),
  verifyEmailArgs: Joi.object({ token: Joi.string().max(200).required() }),
  deleteMe: {
    body: Joi.object({ password: Joi.string().required() }),
  },
};

module.exports = auth;
