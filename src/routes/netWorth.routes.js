const { Router } = require('express');
const controller = require('../controllers/netWorth.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { netWorth: schemas } = require('../validators');

const router = Router();
router.use(authenticate);

router.get('/summary', controller.summary);
router.get('/', validate(schemas.list), controller.list);
router.post('/', validate(schemas.create), controller.create);
router.get('/:id', validate(schemas.byId), controller.get);
router.put('/:id', validate(schemas.update), controller.update);
router.delete('/:id', validate(schemas.byId), controller.remove);

module.exports = router;
