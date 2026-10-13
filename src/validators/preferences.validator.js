const { Joi, money } = require('./common');

const preferences = {
  update: {
    body: Joi.object({
      theme: Joi.string().valid('dark', 'light'),
      currency: Joi.string().uppercase().length(3).pattern(/^[A-Z]{3}$/, 'ISO 4217 (ej. MXN)'),
      defaultBudget: money.allow(null),
      hideAmounts: Joi.boolean(),
    }).min(1),
  },
};

module.exports = preferences;
