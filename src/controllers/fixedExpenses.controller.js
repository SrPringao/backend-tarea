// Gastos fijos y pagos (SQL nativo)
const ApiError = require('../utils/ApiError');
const { ok, noContent } = require('../utils/response');
const { currentMonth } = require('../utils/dates');
const FixedExpense = require('../models/sql/fixedExpenses.sql');
const Ownership = require('../models/sql/ownership.sql');

const round = (n) => Number(n.toFixed(2));

async function assertCategory(userId, categoryId) {
  if (categoryId && !(await Ownership.categoryBelongs(userId, categoryId))) {
    throw ApiError.badRequest('La categoría no existe o no es tuya', [{ field: 'categoryId', message: 'Categoría inválida' }]);
  }
}

async function list(req, res) {
  const month = req.validated.query.month || currentMonth();
  const items = await FixedExpense.findAll(req.user.id, month);

  const total = items.reduce((sum, f) => sum + f.amount, 0);
  const paid = items.filter((f) => f.paid).reduce((sum, f) => sum + f.paidAmount, 0);
  const pendingTotal = items.filter((f) => !f.paid).reduce((sum, f) => sum + f.amount, 0);

  return ok(res, items, 200, { month, total: round(total), paidTotal: round(paid), pendingTotal: round(pendingTotal) });
}

async function get(req, res) {
  const fixed = await FixedExpense.findById(req.user.id, req.validated.params.id);
  if (!fixed) throw ApiError.notFound('Gasto fijo no encontrado');
  const payments = await FixedExpense.paymentHistory(fixed.id);
  return ok(res, { ...fixed, payments });
}

async function create(req, res) {
  await assertCategory(req.user.id, req.validated.body.categoryId);
  return ok(res, await FixedExpense.create(req.user.id, req.validated.body), 201);
}

async function update(req, res) {
  await assertCategory(req.user.id, req.validated.body.categoryId);
  const fixed = await FixedExpense.update(req.user.id, req.validated.params.id, req.validated.body);
  if (!fixed) throw ApiError.notFound('Gasto fijo no encontrado');
  return ok(res, fixed);
}

async function remove(req, res) {
  const deleted = await FixedExpense.remove(req.user.id, req.validated.params.id);
  if (!deleted) throw ApiError.notFound('Gasto fijo no encontrado');
  return noContent(res);
}

async function pay(req, res) {
  const { id } = req.validated.params;
  const { month, amount } = req.validated.body;

  if (!(await FixedExpense.findById(req.user.id, id))) throw ApiError.notFound('Gasto fijo no encontrado');

  const payment = await FixedExpense.markPaid(req.user.id, id, month, amount);
  if (!payment) throw ApiError.conflict(`Este gasto fijo ya está marcado como pagado en ${month}`);
  return ok(res, payment, 201);
}

async function unpay(req, res) {
  const { id, month } = req.validated.params;
  const deleted = await FixedExpense.unmarkPaid(req.user.id, id, month);
  if (!deleted) throw ApiError.notFound('No existe un pago registrado para ese mes');
  return noContent(res);
}

module.exports = { list, get, create, update, remove, pay, unpay };
