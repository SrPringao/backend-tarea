const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimit');
const { auth: schemas } = require('../validators');

const router = Router();

router.post('/register', authLimiter, validate(schemas.register), controller.register);
router.post('/login', authLimiter, validate(schemas.login), controller.login);
router.get('/me', authenticate, controller.me);
router.put('/me', authenticate, validate(schemas.updateMe), controller.updateMe);
router.put('/password', authenticate, validate(schemas.changePassword), controller.changePassword);

module.exports = router;
