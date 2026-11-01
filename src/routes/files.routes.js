const { Router } = require('express');
const { Joi } = require('../validators/common');
const controller = require('../controllers/files.controller');
const validate = require('../middlewares/validate');

const router = Router();

const signedQuery = {
  query: Joi.object({
    path: Joi.string().max(300).pattern(/^[0-9a-f-]{36}\/(accounts|receipts)\/[0-9a-f-]{36}\.(jpg|png|pdf)$/, 'ruta de archivo').required(),
    expires: Joi.number().integer().required(),
    sig: Joi.string().max(100).required(),
  }),
};

router.get('/', validate(signedQuery), controller.download);

module.exports = router;
