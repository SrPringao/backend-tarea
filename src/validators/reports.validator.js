const { Joi, month } = require('./common');

const reports = {
  dashboard: { query: Joi.object({ month }) },
  trend: { query: Joi.object({ months: Joi.number().integer().min(1).max(24).default(6) }) },

  // Argumentos de las operaciones GraphQL (etapa 2)
  dailyArgs: Joi.object({ month }),
  comparisonArgs: Joi.object({ monthA: month, monthB: month }),
};

module.exports = reports;
