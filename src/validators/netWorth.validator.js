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
};

module.exports = netWorth;
