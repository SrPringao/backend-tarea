// Presupuestos mensuales (SQL nativo)
const ApiError = require('../utils/ApiError');
const { ok, noContent } = require('../utils/response');
const { currentMonth, daysInMonth } = require('../utils/dates');
const Budget = require('../models/sql/budgets.sql');

const round = (n) => Number(n.toFixed(2));

async function list(req, res) {
  return ok(res, await Budget.findAll(req.user.id, req.validated.query.year));
}

async function upsert(req, res) {
  const { month } = req.validated.params;
  const { budget, inserted } = await Budget.upsert(req.user.id, month, req.validated.body.amount);
  return ok(res, budget, inserted ? 201 : 200);
}

// Estado del mes con ritmo de gasto: promedio diario y proyección al cierre
async function status(req, res) {
  const { month } = req.validated.params;
  const row = await Budget.status(req.user.id, month);

  const totalDays = daysInMonth(month);
  const today = currentMonth();
  let elapsedDays = totalDays;
  if (month === today) elapsedDays = new Date().getDate();
  else if (month > today) elapsedDays = 0;

  const dailyAverage = elapsedDays ? round(row.spent / elapsedDays) : 0;
  const projected = month > today ? 0 : round(dailyAverage * totalDays);
  const budget = row.budget;

  return ok(res, {
    month,
    budget,
    source: row.source,
    spent: row.spent,
    expenseCount: row.expenseCount,
    remaining: budget === null ? null : round(budget - row.spent),
    percentUsed: budget === null ? null : round((row.spent * 100) / budget),
    daysInMonth: totalDays,
    elapsedDays,
    dailyAverage,
    projectedSpent: projected,
    onTrack: budget === null ? null : projected <= budget,
  });
}

async function remove(req, res) {
  const deleted = await Budget.remove(req.user.id, req.validated.params.month);
  if (!deleted) throw ApiError.notFound('No hay presupuesto registrado para ese mes');
  return noContent(res);
}

module.exports = { list, upsert, status, remove };
