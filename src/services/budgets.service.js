// Presupuestos (SQL nativo): alertas al rebasar el presupuesto o el límite de una categoría (OP-057)
const Budget = require('../models/sql/budgets.sql');
const NotificationLog = require('../models/sql/notificationLog.sql');
const mail = require('./mail');
const { currentMonth } = require('../utils/dates');

const THRESHOLDS = [80, 100];
const round2 = (n) => Math.round(n * 100) / 100;

// Mayor umbral alcanzado (80 % o 100 %), o null si no se alcanzó ninguno
function reachedThreshold(spent, limit) {
  const percent = (spent * 100) / limit;
  return THRESHOLDS.filter((t) => percent >= t).pop() ?? null;
}

// Calcula las alertas del mes y envía un correo con las que no se habían notificado.
// Cada alerta (mes + presupuesto/categoría + umbral) se notifica una sola vez gracias a notification_log.
async function checkAlerts(userId, month = currentMonth()) {
  const [status, categories] = await Promise.all([Budget.status(userId, month), Budget.categoryLimits(userId, month)]);

  const candidates = [];
  if (status.budget) {
    const threshold = reachedThreshold(status.spent, status.budget);
    if (threshold) candidates.push({ type: 'BUDGET', label: 'Presupuesto del mes', limit: status.budget, spent: status.spent, threshold, ref: `${month}:budget:${threshold}` });
  }
  for (const c of categories) {
    const threshold = reachedThreshold(c.spent, c.limit);
    if (threshold) candidates.push({ type: 'CATEGORY', label: `Categoría ${c.name}`, categoryId: c.id, limit: c.limit, spent: c.spent, threshold, ref: `${month}:category:${c.id}:${threshold}` });
  }

  const alerts = [];
  for (const { ref, ...alert } of candidates) {
    const notified = await NotificationLog.markSent(userId, 'budget_alert', ref);
    alerts.push({ ...alert, month, percentUsed: round2((alert.spent * 100) / alert.limit), notified });
  }

  const fresh = alerts.filter((a) => a.notified);
  if (fresh.length) {
    const user = await NotificationLog.findUser(userId);
    await mail.send(user.email, 'budgetAlert', { name: user.displayName, alerts: fresh });
  }
  return alerts;
}

// Para la tarea programada: revisa a todos los usuarios activos
async function checkAlertsForAll() {
  let notified = 0;
  for (const user of await NotificationLog.activeUsers()) {
    const alerts = await checkAlerts(user.id);
    if (alerts.some((a) => a.notified)) notified += 1;
  }
  return notified;
}

module.exports = { checkAlerts, checkAlertsForAll };
