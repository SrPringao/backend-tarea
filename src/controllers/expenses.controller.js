// Gastos (SQL nativo)
const ApiError = require('../utils/ApiError');
const { ok, noContent, pageParams, pageMeta } = require('../utils/response');
const Expense = require('../models/sql/expenses.sql');
const Ownership = require('../models/sql/ownership.sql');

// La cuenta debe ser del usuario y no estar archivada; la categoría (opcional) también debe ser suya
async function assertRelations(userId, { accountId, categoryId }) {
  if (accountId !== undefined && !(await Ownership.accountIsUsable(userId, accountId))) {
    throw ApiError.badRequest('La cuenta no existe, no es tuya o está archivada', [{ field: 'accountId', message: 'Cuenta inválida' }]);
  }
  if (categoryId && !(await Ownership.categoryBelongs(userId, categoryId))) {
    throw ApiError.badRequest('La categoría no existe o no es tuya', [{ field: 'categoryId', message: 'Categoría inválida' }]);
  }
}

function assertRange(from, to) {
  if (from && to && from > to) throw ApiError.badRequest('El parámetro from debe ser anterior o igual a to');
}

async function list(req, res) {
  const { page: p, limit: l, sort, order, ...filters } = req.validated.query;
  assertRange(filters.from, filters.to);
  if (filters.minAmount !== undefined && filters.maxAmount !== undefined && filters.minAmount > filters.maxAmount) {
    throw ApiError.badRequest('minAmount no puede ser mayor que maxAmount');
  }

  const { page, limit, offset } = pageParams({ page: p, limit: l });
  const { rows, total, totalAmount } = await Expense.findAll(req.user.id, filters, { limit, offset, sort, order });
  return ok(res, rows, 200, { ...pageMeta(total, page, limit), totalAmount });
}

async function get(req, res) {
  const expense = await Expense.findById(req.user.id, req.validated.params.id);
  if (!expense) throw ApiError.notFound('Gasto no encontrado');
  return ok(res, expense);
}

async function create(req, res) {
  await assertRelations(req.user.id, req.validated.body);
  const expense = await Expense.create(req.user.id, req.validated.body);
  return ok(res, expense, 201);
}

async function update(req, res) {
  await assertRelations(req.user.id, req.validated.body);
  const expense = await Expense.update(req.user.id, req.validated.params.id, req.validated.body);
  if (!expense) throw ApiError.notFound('Gasto no encontrado');
  return ok(res, expense);
}

async function remove(req, res) {
  const deleted = await Expense.remove(req.user.id, req.validated.params.id);
  if (!deleted) throw ApiError.notFound('Gasto no encontrado');
  return noContent(res);
}

async function summary(req, res) {
  const { from, to } = req.validated.query;
  assertRange(from, to);
  const categories = await Expense.summaryByCategory(req.user.id, from, to);
  const total = Number(categories.reduce((sum, c) => sum + c.total, 0).toFixed(2));
  return ok(res, { from, to, total, categories });
}

module.exports = { list, get, create, update, remove, summary };
