const { Joi, id, isoDate, trimmed } = require('./common');

const notifications = {
  // REST: notificación informativa por correo (solo admin)
  sendEmail: {
    body: Joi.object({
      userId: Joi.string().guid({ version: 'uuidv4' }).required(),
      subject: trimmed(120).required(),
      message: Joi.string().trim().min(1).max(2000).required(),
    }),
  },

  // Argumentos de las operaciones GraphQL (etapa 2)
  registerDeviceArgs: Joi.object({
    token: Joi.string().trim().min(10).max(255).required(),
    platform: Joi.string().valid('android', 'ios', 'web').required(),
  }),
  dailySummaryArgs: Joi.object({ date: isoDate }),
  byIdArgs: Joi.object({ id: id.required() }),
};

module.exports = notifications;
