// Tareas programadas (node-cron). Apagadas por defecto; se activan con ENABLE_SCHEDULER=true.
// Cada mañana: alertas de presupuesto, recordatorios de gastos fijos y resumen de gastos del día anterior.
// Las mismas acciones existen como mutaciones GraphQL para ejecutarlas a mano.
const cron = require('node-cron');
const budgets = require('./budgets.service');
const fixedExpenses = require('./fixedExpenses.service');
const notifications = require('./notifications.service');

const TIMEZONE = process.env.SCHEDULER_TZ || 'America/Mexico_City';

async function runDailyJobs() {
  const started = Date.now();
  try {
    const alerts = await budgets.checkAlertsForAll();
    const reminders = await fixedExpenses.sendRemindersForAll();
    const summary = await notifications.sendDailySummary();
    console.log(
      `[TAREAS] Alertas: ${alerts} usuario(s) · Recordatorios: ${reminders} · Resúmenes: ${summary.sent} (${Date.now() - started} ms)`
    );
  } catch (error) {
    console.error('[TAREAS] Error en las tareas diarias:', error.message);
  }
}

function start() {
  const task = cron.schedule('0 8 * * *', runDailyJobs, { timezone: TIMEZONE });
  console.log(`Tareas programadas activas: todos los días a las 08:00 (${TIMEZONE})`);
  return task;
}

module.exports = { start, runDailyJobs };
