// Gastos (SQL nativo)
const expenses = require('../../services/expenses.service');
const storage = require('../../services/storage');
const { expenses: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  Expense: {
    receiptUrl: (expense) => storage.signedUrl(expense.receiptPath),
    // El gasto ya se obtuvo autorizado; se filtra también por el dueño (Bearer o, en el webhook, X-API-Key)
    splits: (expense, _, ctx) => expenses.findSplits((ctx.user || ctx.apiUser || requireUser(ctx)).id, expense.id),
  },
  Query: {
    expenseSuggestions: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { prefix, limit } = validateArgs(schemas.suggestionsArgs, args);
      return expenses.suggestions(user.id, prefix, limit);
    },
    exportExpensesCsv: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { from, to } = validateArgs(schemas.exportArgs, args);
      return expenses.exportCsv(user.id, from, to);
    },
  },
  Mutation: {
    importExpensesCsv: (_, args, ctx) => {
      const user = requireUser(ctx);
      return expenses.importCsv(user.id, validateArgs(schemas.importArgs, args));
    },
    attachReceipt: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { expenseId, file } = validateArgs(schemas.attachReceiptArgs, args);
      return expenses.attachReceipt(user.id, expenseId, file);
    },
    splitExpense: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { expenseId, parts } = validateArgs(schemas.splitArgs, args);
      return expenses.split(user.id, expenseId, parts);
    },
  },
};
