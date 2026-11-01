const { Joi, id, idParams, isoDate, trimmed } = require('./common');

const netWorthBody = {
  label: trimmed(80),
  kind: Joi.string().valid('asset', 'debt'),
  amount: Joi.number().min(0).precision(2).max(9999999999.99),
  dueDate: isoDate.allow(null),
  accountId: id.allow(null),
  contactId: id.allow(null),
  sortOrder: Joi.number().integer().min(0),
};

const netWorth = {
  list: { query: Joi.object({ kind: Joi.string().valid('asset', 'debt') }) },
  create: {
    body: Joi.object({
      ...netWorthBody,
      label: netWorthBody.label.required(),
      kind: netWorthBody.kind.required(),
      amount: netWorthBody.amount.required(),
    }),
  },
  update: { params: idParams, body: Joi.object(netWorthBody).min(1) },
  byId: { params: idParams },

  // Argumentos de las operaciones GraphQL (etapa 2)
  reorderArgs: Joi.object({ ids: Joi.array().items(id).min(1).max(200).required() }),
  syncArgs: Joi.object({ entryId: id.required() }),
  createProjectionArgs: Joi.object({
    name: trimmed(80).required(),
    startingAmount: Joi.number().min(-9999999999.99).max(9999999999.99).precision(2).allow(null),
    monthlyContribution: Joi.number().min(0).max(9999999999.99).precision(2).required(),
    annualRate: Joi.number().min(0).max(100).precision(2).required(),
    months: Joi.number().integer().min(1).max(600).required(),
  }),
  byIdArgs: Joi.object({ id: id.required() }),
};

module.exports = netWorth;
