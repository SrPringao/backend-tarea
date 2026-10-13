const { Router } = require('express');
const controller = require('../controllers/expenses.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { expenses: schemas } = require('../validators');

const router = Router();
router.use(authenticate);

// /summary va antes de /:id para que no se interprete como un id
router.get('/summary', validate(schemas.summary), controller.summary);
router.get('/', validate(schemas.list), controller.list);
router.post('/', validate(schemas.create), controller.create);
router.get('/:id', validate(schemas.byId), controller.get);
router.put('/:id', validate(schemas.update), controller.update);
router.delete('/:id', validate(schemas.byId), controller.remove);

module.exports = router;
