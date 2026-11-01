const { Joi, id, idParams, money, color, trimmed } = require('./common');

const categories = {
  list: { query: Joi.object({ search: Joi.string().trim().max(40) }) },
  create: { body: Joi.object({ name: trimmed(40).required(), color: color.allow(null) }) },
  update: { params: idParams, body: Joi.object({ name: trimmed(40), color: color.allow(null) }).min(1) },
  byId: { params: idParams },

  // Argumentos de las operaciones GraphQL (etapa 2)
  mergeArgs: Joi.object({ sourceId: id.required(), targetId: id.required() }),
  setLimitArgs: Joi.object({ categoryId: id.required(), monthlyLimit: money.allow(null).required() }),
};

module.exports = categories;
