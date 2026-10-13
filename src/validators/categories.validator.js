const { Joi, idParams, color, trimmed } = require('./common');

const categories = {
  list: { query: Joi.object({ search: Joi.string().trim().max(40) }) },
  create: { body: Joi.object({ name: trimmed(40).required(), color: color.allow(null) }) },
  update: { params: idParams, body: Joi.object({ name: trimmed(40), color: color.allow(null) }).min(1) },
  byId: { params: idParams },
};

module.exports = categories;
