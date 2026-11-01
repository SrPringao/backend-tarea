// Notificaciones (Sequelize ORM): dispositivos para push (OP-082, OP-083), resumen diario por correo (OP-084)
// y notificación informativa enviada por un administrador (servicio de correo, REST).
const { QueryTypes } = require('sequelize');
const ApiError = require('../utils/ApiError');
const mail = require('./mail');
const { sequelize, Device, User, NotificationLog } = require('../models/orm');

// Registra (o actualiza) el token de FCM del dispositivo. El envío real de push queda para la etapa de Flutter.
async function registerDevice(userId, { token, platform }) {
  const [device, created] = await Device.findOrCreate({ where: { userId, token }, defaults: { platform } });
  if (!created) await device.update({ platform, lastSeenAt: new Date() });
  return device;
}

const listDevices = (userId) => Device.findAll({ where: { userId }, order: [['lastSeenAt', 'DESC']] });

// Fecha de ayer en hora local (YYYY-MM-DD)
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function summaryFor(userId, date) {
  const month = date.slice(0, 7);
  const [day] = await sequelize.query(
    `SELECT COALESCE(SUM(e.amount), 0)::float AS total, COUNT(*)::int AS count,
            (SELECT c.name FROM expenses x JOIN categories c ON c.id = x.category_id
             WHERE x.user_id = :userId AND x.date = :date GROUP BY c.name ORDER BY SUM(x.amount) DESC LIMIT 1) AS "topCategory"
     FROM expenses e WHERE e.user_id = :userId AND e.date = :date`,
    { replacements: { userId, date }, type: QueryTypes.SELECT }
  );
  const [budget] = await sequelize.query(
    `SELECT COALESCE(b.amount, p.default_budget)::float AS budget,
            (SELECT COALESCE(SUM(amount), 0)::float FROM expenses
             WHERE user_id = :userId AND TO_CHAR(date, 'YYYY-MM') = :month) AS spent
     FROM user_preferences p
     LEFT JOIN monthly_budgets b ON b.user_id = p.user_id AND b.month = :month
     WHERE p.user_id = :userId`,
    { replacements: { userId, month }, type: QueryTypes.SELECT }
  );
  const budgetRemaining = budget?.budget ? Math.round((budget.budget - budget.spent) * 100) / 100 : null;
  return { ...day, budgetRemaining };
}

// Envía el resumen del día a cada usuario activo con correo verificado que haya tenido gastos.
// notification_log evita mandar dos veces el resumen del mismo día.
async function sendDailySummary(date = yesterday()) {
  const users = await User.findAll({ where: { isActive: true } });
  let sent = 0;
  let skipped = 0;
  for (const user of users) {
    if (!user.emailVerifiedAt) {
      skipped += 1;
      continue;
    }
    const summary = await summaryFor(user.id, date);
    if (summary.count === 0) {
      skipped += 1;
      continue;
    }
    const [, created] = await NotificationLog.findOrCreate({ where: { userId: user.id, kind: 'daily_summary', ref: date } });
    if (!created) {
      skipped += 1;
      continue;
    }
    await mail.send(user.email, 'dailySummary', { name: user.displayName, date, ...summary });
    sent += 1;
  }
  return { date, sent, skipped };
}

// Notificación informativa (la envía un administrador a un usuario)
async function sendInformative(userId, { subject, message }) {
  const user = await User.findByPk(userId);
  if (!user || !user.isActive) throw ApiError.notFound('Usuario no encontrado o desactivado');
  await mail.send(user.email, 'informative', { name: user.displayName, subject, message });
  return { to: user.email, subject, sentAt: new Date() };
}

module.exports = { registerDevice, listDevices, sendDailySummary, sendInformative, yesterday };
