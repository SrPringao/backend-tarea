const { Joi, idParams, trimmed } = require('./common');

const contacts = {
  list: { query: Joi.object({ includeArchived: Joi.boolean().default(false) }) },
  create: { body: Joi.object({ name: trimmed(60).required() }) },
  update: { params: idParams, body: Joi.object({ name: trimmed(60), archived: Joi.boolean() }).min(1) },
  byId: { params: idParams },
};

module.exports = contacts;
