// Reportes (SQL nativo)
const reports = require('../../services/reports.service');
const { reports: schemas } = require('../../validators');
const { requireUser, validateArgs } = require('../guards');

module.exports = {
  Query: {
    dailySpending: (_, args, ctx) => {
      const user = requireUser(ctx);
      return reports.dailySpending(user.id, validateArgs(schemas.dailyArgs, args).month);
    },
    categoryComparison: (_, args, ctx) => {
      const user = requireUser(ctx);
      const { monthA, monthB } = validateArgs(schemas.comparisonArgs, args);
      return reports.categoryComparison(user.id, monthA, monthB);
    },
  },
};
