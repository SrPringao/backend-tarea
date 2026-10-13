// Esquemas de validación por módulo. Se usan en las rutas (middleware validate)
// y también para generar la documentación OpenAPI.
const { Joi, id, idParams, isoDate, month, money, color, dayOfMonth, pagination, password } = require('./common');

const trimmed = (max) => Joi.string().trim().min(1).max(max);

const auth = {
  register: {
    body: Joi.object({
      email: Joi.string().trim().email().max(160).required(),
      password: password.required(),
      displayName: trimmed(80).required(),
    }),
  },
  login: {
    body: Joi.object({
      email: Joi.string().trim().email().required(),
      password: Joi.string().required(),
    }),
  },
  updateMe: {
    body: Joi.object({
      displayName: trimmed(80),
      email: Joi.string().trim().email().max(160),
    }).min(1),
  },
  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: password.required().invalid(Joi.ref('currentPassword')).messages({
        'any.invalid': 'newPassword debe ser distinta a la contraseña actual',
      }),
    }),
  },
};

const users = {
  list: {
    query: Joi.object({
      ...pagination,
      search: Joi.string().trim().max(80),
      role: Joi.string().valid('user', 'admin'),
      isActive: Joi.boolean(),
    }),
  },
  byId: { params: Joi.object({ id: Joi.string().guid({ version: 'uuidv4' }).required() }) },
  update: {
    params: Joi.object({ id: Joi.string().guid({ version: 'uuidv4' }).required() }),
    body: Joi.object({
      displayName: trimmed(80),
      role: Joi.string().valid('user', 'admin'),
      isActive: Joi.boolean(),
    }).min(1),
  },
};

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
};

const categories = {
  list: { query: Joi.object({ search: Joi.string().trim().max(40) }) },
  create: { body: Joi.object({ name: trimmed(40).required(), color: color.allow(null) }) },
  update: { params: idParams, body: Joi.object({ name: trimmed(40), color: color.allow(null) }).min(1) },
  byId: { params: idParams },
};

const contacts = {
  list: { query: Joi.object({ includeArchived: Joi.boolean().default(false) }) },
  create: { body: Joi.object({ name: trimmed(60).required() }) },
  update: { params: idParams, body: Joi.object({ name: trimmed(60), archived: Joi.boolean() }).min(1) },
  byId: { params: idParams },
};

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

const budgets = {
  list: { query: Joi.object({ year: Joi.number().integer().min(2000).max(2100) }) },
  byMonth: { params: Joi.object({ month: month.required() }) },
  upsert: { params: Joi.object({ month: month.required() }), body: Joi.object({ amount: money.required() }) },
};

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

const reports = {
  dashboard: { query: Joi.object({ month }) },
  trend: { query: Joi.object({ months: Joi.number().integer().min(1).max(24).default(6) }) },
};

module.exports = { auth, users, accounts, categories, contacts, preferences, expenses, budgets, fixedExpenses, netWorth, reports };
