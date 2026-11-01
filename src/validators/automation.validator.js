const { Joi, id, isoDate, money, trimmed } = require('./common');

// Argumentos de las operaciones GraphQL del módulo de automatización
const automation = {
  createApiTokenArgs: Joi.object({ name: trimmed(60).required() }),
  byIdArgs: Joi.object({ id: id.required() }),
  createCardNameMappingArgs: Joi.object({ cardName: trimmed(60).required(), accountId: id.required() }),
  webhookExpenseArgs: Joi.object({
    amount: money.required(),
    card: trimmed(60).required(),
    description: Joi.string().trim().max(200).allow('', null),
    date: isoDate,
    category: trimmed(40),
  }),
};

module.exports = automation;
