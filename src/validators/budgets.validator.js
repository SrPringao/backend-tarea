const { Joi, month, money } = require('./common');

const budgets = {
  list: { query: Joi.object({ year: Joi.number().integer().min(2000).max(2100) }) },
  byMonth: { params: Joi.object({ month: month.required() }) },
  upsert: { params: Joi.object({ month: month.required() }), body: Joi.object({ amount: money.required() }) },

  // Argumentos de las operaciones GraphQL (etapa 2)
  alertsArgs: Joi.object({ month }),
};

module.exports = budgets;
