const { Router } = require('express');
const controller = require('../controllers/fixedExpenses.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { fixedExpenses: schemas } = require('../validators');

const router = Router();
router.use(authenticate);

router.get('/', validate(schemas.list), controller.list);
router.post('/', validate(schemas.create), controller.create);
router.get('/:id', validate(schemas.byId), controller.get);
router.put('/:id', validate(schemas.update), controller.update);
router.delete('/:id', validate(schemas.byId), controller.remove);
router.post('/:id/payments', validate(schemas.pay), controller.pay);
router.delete('/:id/payments/:month', validate(schemas.unpay), controller.unpay);

module.exports = router;
