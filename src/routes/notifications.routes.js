const { Router } = require('express');
const controller = require('../controllers/notifications.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { mailLimiter } = require('../middlewares/rateLimit');
const { notifications: schemas } = require('../validators');

const router = Router();
router.use(authenticate, authorize('admin'));

// A diferencia de un "enviar_correo" público, solo un admin puede usarlo y solo hacia usuarios registrados
router.post('/email', mailLimiter, validate(schemas.sendEmail), controller.sendEmail);

module.exports = router;
