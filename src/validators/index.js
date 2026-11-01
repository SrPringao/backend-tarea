// Esquemas de validación por módulo (un archivo por módulo). Se usan en las rutas
// (middleware validate) y también para generar la documentación OpenAPI.
const auth = require('./auth.validator');
const users = require('./users.validator');
const accounts = require('./accounts.validator');
const categories = require('./categories.validator');
const contacts = require('./contacts.validator');
const preferences = require('./preferences.validator');
const expenses = require('./expenses.validator');
const budgets = require('./budgets.validator');
const fixedExpenses = require('./fixedExpenses.validator');
const netWorth = require('./netWorth.validator');
const reports = require('./reports.validator');
const automation = require('./automation.validator');
const notifications = require('./notifications.validator');

module.exports = { auth, users, accounts, categories, contacts, preferences, expenses, budgets, fixedExpenses, netWorth, reports, automation, notifications };
