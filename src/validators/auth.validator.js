const { Joi, password, trimmed } = require('./common');

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
  deleteMe: {
    body: Joi.object({ password: Joi.string().required() }),
  },
};

module.exports = auth;
