const { Joi, id, idParams, isoDate, money, pagination } = require('./common');

const expenseBody = {
  amount: money,
  date: isoDate,
  description: Joi.string().trim().max(200).allow('', null),
  accountId: id,
  categoryId: id.allow(null),
};

const expenses = {
  list: {
    query: Joi.object({
      ...pagination,
      from: isoDate,
      to: isoDate,
      accountId: id,
      categoryId: id,
      minAmount: Joi.number().min(0),
      maxAmount: Joi.number().min(0),
      search: Joi.string().trim().max(100),
      sort: Joi.string().valid('date', 'amount', 'createdAt').default('date'),
      order: Joi.string().valid('asc', 'desc').default('desc'),
    }),
  },
  create: {
    body: Joi.object({
      ...expenseBody,
      amount: expenseBody.amount.required(),
      date: expenseBody.date.required(),
      accountId: expenseBody.accountId.required(),
    }),
  },
  update: { params: idParams, body: Joi.object(expenseBody).min(1) },
  byId: { params: idParams },
  summary: {
    query: Joi.object({ from: isoDate.required(), to: isoDate.required() }),
  },
};

module.exports = expenses;
