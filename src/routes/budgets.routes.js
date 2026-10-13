const { Router } = require('express');
const controller = require('../controllers/budgets.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { budgets: schemas } = require('../validators');

const router = Router();
router.use(authenticate);

router.get('/', validate(schemas.list), controller.list);
router.get('/:month', validate(schemas.byMonth), controller.status);
router.put('/:month', validate(schemas.upsert), controller.upsert);
router.delete('/:month', validate(schemas.byMonth), controller.remove);

module.exports = router;
