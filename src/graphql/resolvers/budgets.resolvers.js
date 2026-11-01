// Presupuestos (SQL nativo)
const budgets = require('../../services/budgets.service');
const { budgets: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  Mutation: {
    checkBudgetAlerts: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { month } = validateArgs(schemas.alertsArgs, args);
      return budgets.checkAlerts(user.id, month);
    },
  },
};
