const { Router } = require('express');
const controller = require('../controllers/reports.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { reports: schemas } = require('../validators');

const router = Router();
router.use(authenticate);

router.get('/dashboard', validate(schemas.dashboard), controller.dashboard);
router.get('/monthly-trend', validate(schemas.trend), controller.trend);

module.exports = router;
