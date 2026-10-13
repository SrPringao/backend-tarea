const { Joi, pagination, trimmed } = require('./common');

const users = {
  list: {
    query: Joi.object({
      ...pagination,
      search: Joi.string().trim().max(80),
      role: Joi.string().valid('user', 'admin'),
      isActive: Joi.boolean(),
    }),
  },
  byId: { params: Joi.object({ id: Joi.string().guid({ version: 'uuidv4' }).required() }) },
  update: {
    params: Joi.object({ id: Joi.string().guid({ version: 'uuidv4' }).required() }),
    body: Joi.object({
      displayName: trimmed(80),
      role: Joi.string().valid('user', 'admin'),
      isActive: Joi.boolean(),
    }).min(1),
  },
};

module.exports = users;
