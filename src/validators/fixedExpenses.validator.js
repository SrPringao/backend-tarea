const { Joi, id, idParams, month, money, dayOfMonth, trimmed } = require('./common');

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
};

module.exports = fixedExpenses;
