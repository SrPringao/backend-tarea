const { Router } = require('express');

const router = Router();

// Módulos con Sequelize ORM
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/accounts', require('./accounts.routes'));
router.use('/categories', require('./categories.routes'));
router.use('/contacts', require('./contacts.routes'));
router.use('/preferences', require('./preferences.routes'));

// Módulos con SQL nativo
router.use('/expenses', require('./expenses.routes'));
router.use('/budgets', require('./budgets.routes'));
router.use('/fixed-expenses', require('./fixedExpenses.routes'));
router.use('/net-worth', require('./netWorth.routes'));
router.use('/reports', require('./reports.routes'));

// Etapa 2: servicio de correo y descarga firmada de archivos locales
router.use('/notifications', require('./notifications.routes'));
router.use('/files', require('./files.routes'));

module.exports = router;
