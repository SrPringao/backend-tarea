// Reportes (SQL nativo): gasto diario del mes (OP-080) y comparativo por categoría entre meses (OP-081)
const ApiError = require('../utils/ApiError');
const Report = require('../models/sql/reports.sql');
const Budget = require('../models/sql/budgets.sql');
const { currentMonth, daysInMonth, addMonths } = require('../utils/dates');

async function dailySpending(userId, month = currentMonth()) {
  const [days, status] = await Promise.all([Report.dailySpending(userId, month), Budget.status(userId, month)]);
  const total = days.length ? days[days.length - 1].cumulative : 0;
  return {
    month,
    total,
    budget: status.budget,
    // Cuánto se puede gastar por día para no pasarse del presupuesto
    dailyBudget: status.budget ? Math.round((status.budget / daysInMonth(month)) * 100) / 100 : null,
    days,
  };
}

// Por defecto compara el mes anterior (A) contra el actual (B)
async function categoryComparison(userId, monthA, monthB) {
  const b = monthB || currentMonth();
  const a = monthA || addMonths(b, -1);
  if (a === b) throw ApiError.badRequest('Los meses a comparar deben ser distintos');
  const categories = await Report.categoryComparison(userId, a, b);
  const totalA = categories.reduce((s, c) => s + c.totalA, 0);
  const totalB = categories.reduce((s, c) => s + c.totalB, 0);
  return { monthA: a, monthB: b, totalA: Math.round(totalA * 100) / 100, totalB: Math.round(totalB * 100) / 100, categories };
}

module.exports = { dailySpending, categoryComparison };
