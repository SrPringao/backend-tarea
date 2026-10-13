const { Router } = require('express');
const controller = require('../controllers/preferences.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { preferences: schemas } = require('../validators');

const router = Router();
router.use(authenticate);

router.get('/', controller.get);
router.put('/', validate(schemas.update), controller.update);

module.exports = router;
