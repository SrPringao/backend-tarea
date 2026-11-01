// Gastos fijos (SQL nativo): generar el gasto real al pagar (OP-065) y recordatorios de pago (OP-066)
const ApiError = require('../utils/ApiError');
const { withTransaction } = require('../config/database');
const FixedExpense = require('../models/sql/fixedExpenses.sql');
const Expense = require('../models/sql/expenses.sql');
const Ownership = require('../models/sql/ownership.sql');
const NotificationLog = require('../models/sql/notificationLog.sql');
const mail = require('./mail');
const { currentMonth, daysInMonth } = require('../utils/dates');

// Registra el gasto real (con la categoría y el nombre del gasto fijo) y marca el mes como pagado
async function toExpense(userId, fixedExpenseId, { month, accountId, date, amount }) {
  const fixed = await FixedExpense.findById(userId, fixedExpenseId);
  if (!fixed) throw ApiError.notFound('Gasto fijo no encontrado');
  if (!(await Ownership.accountIsUsable(userId, accountId))) {
    throw ApiError.badRequest('La cuenta no existe, no es tuya o está archivada', [{ field: 'accountId', message: 'Cuenta inválida' }]);
  }
  if (date && !date.startsWith(month)) throw ApiError.badRequest('La fecha debe pertenecer al mes indicado');

  const day = Math.min(fixed.dayOfMonth || 1, daysInMonth(month));
  const expenseDate = date || `${month}-${String(day).padStart(2, '0')}`;

  const { expenseId, payment } = await withTransaction(async (client) => {
    const existing = await FixedExpense.findPayment(client, fixed.id, month);
    if (existing?.expenseId) throw ApiError.conflict(`Ya se generó el gasto de ${fixed.name} para ${month}`);
    const finalAmount = amount ?? existing?.amount ?? fixed.amount;
    return FixedExpense.createExpenseForPayment(client, userId, fixed, { month, accountId, date: expenseDate, amount: finalAmount });
  });

  return { expense: await Expense.findById(userId, expenseId), payment };
}

// Gastos fijos sin pagar que vencen en los próximos días del mes; envía correo con los no recordados aún
async function sendReminders(userId, daysAhead = 3, now = new Date()) {
  const month = currentMonth();
  const fromDay = now.getDate();
  const toDay = Math.min(fromDay + daysAhead, daysInMonth(month));
  const due = await FixedExpense.unpaidDueBetween(userId, month, fromDay, toDay);

  const reminders = [];
  for (const item of due) {
    const notified = await NotificationLog.markSent(userId, 'payment_reminder', `${month}:fixed:${item.id}`);
    reminders.push({ ...item, fixedExpenseId: item.id, month, notified });
  }

  const fresh = reminders.filter((r) => r.notified);
  if (fresh.length) {
    const user = await NotificationLog.findUser(userId);
    await mail.send(user.email, 'paymentReminder', { name: user.displayName, items: fresh });
  }
  return reminders;
}

async function sendRemindersForAll(daysAhead = 3) {
  let notified = 0;
  for (const user of await NotificationLog.activeUsers()) {
    const reminders = await sendReminders(user.id, daysAhead);
    if (reminders.some((r) => r.notified)) notified += 1;
  }
  return notified;
}

module.exports = { toExpense, sendReminders, sendRemindersForAll };
