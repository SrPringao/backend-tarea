// Reportes (SQL nativo)
const { ok } = require('../utils/response');
const { currentMonth } = require('../utils/dates');
const Report = require('../models/sql/reports.sql');
const Budget = require('../models/sql/budgets.sql');

async function dashboard(req, res) {
  const month = req.validated.query.month || currentMonth();
  const [data, budget] = await Promise.all([Report.dashboard(req.user.id, month), Budget.status(req.user.id, month)]);

  const spent = data.spent.total;
  const previous = data.previousMonthSpent;
  const changeVsPreviousMonth = previous ? Number((((spent - previous) * 100) / previous).toFixed(2)) : null;

  return ok(res, {
    month,
    spent,
    expenseCount: data.spent.count,
    previousMonthSpent: previous,
    changeVsPreviousMonth,
    budget: budget.budget,
    budgetRemaining: budget.budget === null ? null : Number((budget.budget - spent).toFixed(2)),
    topCategories: data.topCategories,
    byAccount: data.byAccount,
    fixedExpenses: data.fixedExpenses,
    recentExpenses: data.recentExpenses,
  });
}

async function trend(req, res) {
  return ok(res, await Report.monthlyTrend(req.user.id, req.validated.query.months));
}

module.exports = { dashboard, trend };
