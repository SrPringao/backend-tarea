const { Joi, month } = require('./common');

const reports = {
  dashboard: { query: Joi.object({ month }) },
  trend: { query: Joi.object({ months: Joi.number().integer().min(1).max(24).default(6) }) },
};

module.exports = reports;
