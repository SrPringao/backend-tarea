const { Joi, id, idParams, isoDate, month, money, dayOfMonth, trimmed } = require('./common');

const fixedExpenseBody = {
  name: trimmed(60),
  amount: money,
  dayOfMonth: dayOfMonth.allow(null),
  categoryId: id.allow(null),
};

const fixedExpenses = {
  list: { query: Joi.object({ month }) },
  create: {
    body: Joi.object({ ...fixedExpenseBody, name: fixedExpenseBody.name.required(), amount: fixedExpenseBody.amount.required() }),
  },
  update: { params: idParams, body: Joi.object(fixedExpenseBody).min(1) },
  byId: { params: idParams },
  pay: { params: idParams, body: Joi.object({ month: month.required(), amount: money }) },
  unpay: { params: Joi.object({ id: id.required(), month: month.required() }) },

  // Argumentos de las operaciones GraphQL (etapa 2)
  toExpenseArgs: Joi.object({
    fixedExpenseId: id.required(),
    month: month.required(),
    accountId: id.required(),
    date: isoDate,
    amount: money,
  }),
  remindersArgs: Joi.object({ daysAhead: Joi.number().integer().min(0).max(15).default(3) }),
};

module.exports = fixedExpenses;
