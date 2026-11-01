const { Joi, id, idParams, month, color, dayOfMonth, trimmed } = require('./common');

const accountBody = {
  name: trimmed(60),
  type: Joi.string().valid('credit', 'debit', 'cash'),
  color: color.allow(null),
  paymentDay: dayOfMonth.allow(null),
  creditLimit: Joi.number().min(0).precision(2).max(9999999999.99).allow(null),
};

const accounts = {
  list: {
    query: Joi.object({
      type: Joi.string().valid('credit', 'debit', 'cash'),
      includeArchived: Joi.boolean().default(false),
    }),
  },
  create: {
    body: Joi.object({
      ...accountBody,
      name: accountBody.name.required(),
      type: accountBody.type.required(),
    }),
  },
  update: { params: idParams, body: Joi.object(accountBody).min(1) },
  archive: { params: idParams, body: Joi.object({ archived: Joi.boolean().required() }) },
  byId: { params: idParams },

  // Argumentos de las operaciones GraphQL (etapa 2)
  reorderArgs: Joi.object({ ids: Joi.array().items(id).min(1).max(100).required() }),
  uploadImageArgs: Joi.object({ accountId: id.required(), file: Joi.any().required() }),
  statementArgs: Joi.object({ accountId: id.required(), month }),
};

module.exports = accounts;
