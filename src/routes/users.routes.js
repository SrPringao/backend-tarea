const { Router } = require('express');
const controller = require('../controllers/users.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { users: schemas } = require('../validators');

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/', validate(schemas.list), controller.list);
router.get('/:id', validate(schemas.byId), controller.get);
router.patch('/:id', validate(schemas.update), controller.update);
router.delete('/:id', validate(schemas.byId), controller.remove);

module.exports = router;
