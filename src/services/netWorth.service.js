// Patrimonio (SQL nativo): reordenar (OP-073), sincronizar con una tarjeta (OP-074) y proyecciones (OP-075 a OP-077)
const ApiError = require('../utils/ApiError');
const NetWorth = require('../models/sql/netWorth.sql');
const { currentMonth } = require('../utils/dates');

const round2 = (n) => Math.round(n * 100) / 100;

async function reorder(userId, ids) {
  if (new Set(ids).size !== ids.length) throw ApiError.badRequest('La lista tiene ids repetidos');
  if ((await NetWorth.countOwned(userId, ids)) !== ids.length) throw ApiError.badRequest('Algún registro no existe o no es tuyo');
  await NetWorth.reorder(userId, ids);
  return NetWorth.findAll(userId);
}

// La deuda ligada a una tarjeta de crédito toma como monto el saldo de la tarjeta en el mes actual
async function syncWithAccount(userId, entryId) {
  const entry = await NetWorth.findById(userId, entryId);
  if (!entry) throw ApiError.notFound('Registro de patrimonio no encontrado');
  if (!entry.accountId) throw ApiError.badRequest('El registro no está ligado a ninguna cuenta');
  if (entry.kind !== 'debt') throw ApiError.badRequest('Solo se sincronizan deudas ligadas a tarjetas de crédito');

  const account = await NetWorth.findAccount(userId, entry.accountId);
  if (!account || account.type !== 'credit') throw ApiError.badRequest('La cuenta ligada no es una tarjeta de crédito');

  const month = currentMonth();
  const balance = await NetWorth.accountMonthBalance(userId, entry.accountId, month);
  const updated = await NetWorth.update(userId, entryId, { amount: balance });
  return { entry: updated, previousAmount: entry.amount, month };
}

// Interés compuesto mensual: saldo(k) = saldo(k-1) * (1 + tasa/12) + aportación
function simulate(projection, step = 12) {
  const rate = projection.annualRate / 100 / 12;
  let balance = projection.startingAmount;
  const schedule = [];
  for (let month = 1; month <= projection.months; month += 1) {
    balance = balance * (1 + rate) + projection.monthlyContribution;
    if (month % step === 0 || month === projection.months) {
      schedule.push({ month, balance: round2(balance), contributed: round2(projection.startingAmount + projection.monthlyContribution * month) });
    }
  }
  const totalContributed = round2(projection.startingAmount + projection.monthlyContribution * projection.months);
  return { finalAmount: round2(balance), totalContributed, interestEarned: round2(balance - totalContributed), schedule };
}

// Si no se indica el monto inicial, parte del patrimonio neto actual (sin bajar de 0)
async function createProjection(userId, data) {
  const startingAmount = data.startingAmount ?? Math.max(0, (await NetWorth.summary(userId)).netWorth);
  return NetWorth.createProjection(userId, { ...data, startingAmount });
}

const listProjections = (userId) => NetWorth.findProjections(userId);

async function deleteProjection(userId, id) {
  if (!(await NetWorth.removeProjection(userId, id))) throw ApiError.notFound('Proyección no encontrada');
  return true;
}

module.exports = { reorder, syncWithAccount, simulate, createProjection, listProjections, deleteProjection };
