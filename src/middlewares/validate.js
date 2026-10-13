const ApiError = require('../utils/ApiError');

// Valida params, query y body con Joi. El resultado limpio (tipos convertidos y
// campos desconocidos eliminados) queda en req.validated.
function validate(schemas) {
  return (req, res, next) => {
    req.validated = req.validated || {};
    const details = [];

    for (const source of ['params', 'query', 'body']) {
      if (!schemas[source]) continue;
      const { value, error } = schemas[source].validate(req[source] ?? {}, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        details.push(...error.details.map((d) => ({ location: source, field: d.path.join('.'), message: d.message })));
      } else {
        req.validated[source] = value;
      }
    }

    if (details.length) throw ApiError.badRequest('Datos inválidos', details);
    next();
  };
}

module.exports = validate;
