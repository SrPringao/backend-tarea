// Gastos fijos (SQL nativo)
const fixedExpenses = require('../../services/fixedExpenses.service');
const { fixedExpenses: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  Mutation: {
    fixedExpenseToExpense: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { fixedExpenseId, ...data } = validateArgs(schemas.toExpenseArgs, args);
      return fixedExpenses.toExpense(user.id, fixedExpenseId, data);
    },
    sendPaymentReminders: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { daysAhead } = validateArgs(schemas.remindersArgs, args);
      return fixedExpenses.sendReminders(user.id, daysAhead);
    },
  },
};
