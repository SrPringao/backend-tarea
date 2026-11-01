// Cuentas (Sequelize ORM): reordenar (OP-024), imagen de la tarjeta (OP-023) y estado de cuenta (OP-025)
const { QueryTypes } = require('sequelize');
const ApiError = require('../utils/ApiError');
const storage = require('./storage');
const { currentMonth, daysInMonth, addMonths } = require('../utils/dates');
const { sequelize, Account } = require('../models/orm');

async function findOwned(userId, id) {
  const account = await Account.findOne({ where: { id, userId } });
  if (!account) throw ApiError.notFound('Cuenta no encontrada');
  return account;
}

// Asigna sort_order según la posición en la lista; todas las cuentas deben ser del usuario
async function reorder(userId, ids) {
  if (new Set(ids).size !== ids.length) throw ApiError.badRequest('La lista de cuentas tiene ids repetidos');
  const owned = await Account.count({ where: { userId, id: ids } });
  if (owned !== ids.length) throw ApiError.badRequest('Alguna cuenta no existe o no es tuya');

  await sequelize.transaction(async (transaction) => {
    for (const [position, id] of ids.entries()) {
      await Account.update({ sortOrder: position }, { where: { id, userId }, transaction });
    }
  });
  return Account.findAll({ where: { userId }, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
}

async function uploadImage(userId, accountId, file) {
  const account = await findOwned(userId, accountId);
  const previous = account.imagePath;
  const imagePath = await storage.save(userId, 'accounts', file, storage.IMAGE_TYPES);
  await account.update({ imagePath });
  await storage.remove(previous);
  return account;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Estado de cuenta de una tarjeta de crédito para un mes (periodo = mes calendario).
// Pago mínimo aproximado a la regla de Banxico: el mayor entre 1.5 % del saldo y 1.25 % del límite, sin pasar del saldo.
async function creditCardStatement(userId, accountId, month = currentMonth()) {
  const account = await findOwned(userId, accountId);
  if (account.type !== 'credit') throw ApiError.badRequest('El estado de cuenta solo aplica a tarjetas de crédito');

  const periodStart = `${month}-01`;
  const periodEnd = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const [{ balance, count }] = await sequelize.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS balance, COUNT(*)::int AS count
     FROM expenses WHERE user_id = :userId AND account_id = :accountId AND date BETWEEN :periodStart AND :periodEnd`,
    { replacements: { userId, accountId, periodStart, periodEnd }, type: QueryTypes.SELECT }
  );

  const nextMonth = addMonths(month, 1);
  const dueDay = Math.min(account.paymentDay || 1, daysInMonth(nextMonth));
  const creditLimit = account.creditLimit;
  const minimum = balance > 0 ? Math.min(balance, Math.max(balance * 0.015, (creditLimit || 0) * 0.0125)) : 0;

  return {
    account,
    month,
    periodStart,
    periodEnd,
    dueDate: `${nextMonth}-${String(dueDay).padStart(2, '0')}`,
    balance: round2(balance),
    expenseCount: count,
    minimumPayment: round2(minimum),
    creditLimit,
    availableCredit: creditLimit === null ? null : round2(creditLimit - balance),
    utilization: creditLimit ? round2((balance * 100) / creditLimit) : null,
  };
}

module.exports = { reorder, uploadImage, creditCardStatement };
