// Cuentas / métodos de pago (Sequelize ORM)
const { ForeignKeyConstraintError } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { ok, noContent } = require('../utils/response');
const { Account } = require('../models/orm');

async function findOwned(userId, id) {
  const account = await Account.findOne({ where: { id, userId } });
  if (!account) throw ApiError.notFound('Cuenta no encontrada');
  return account;
}

// Límite de crédito y día de pago solo tienen sentido en tarjetas de crédito
function normalizeCreditFields(data) {
  if (data.type && data.type !== 'credit') {
    return { ...data, creditLimit: null, paymentDay: null };
  }
  return data;
}

async function list(req, res) {
  const { type, includeArchived } = req.validated.query;
  const where = { userId: req.user.id };
  if (type) where.type = type;
  if (!includeArchived) where.archivedAt = null;

  const accounts = await Account.findAll({ where, order: [['name', 'ASC']] });
  return ok(res, accounts);
}

async function get(req, res) {
  return ok(res, await findOwned(req.user.id, req.validated.params.id));
}

async function create(req, res) {
  const data = normalizeCreditFields(req.validated.body);
  const account = await Account.create({ ...data, userId: req.user.id });
  return ok(res, account, 201);
}

async function update(req, res) {
  const account = await findOwned(req.user.id, req.validated.params.id);
  const data = normalizeCreditFields({ type: account.type, ...req.validated.body });
  await account.update(data);
  return ok(res, account);
}

async function archive(req, res) {
  const account = await findOwned(req.user.id, req.validated.params.id);
  await account.update({ archivedAt: req.validated.body.archived ? new Date() : null });
  return ok(res, account);
}

async function remove(req, res) {
  const account = await findOwned(req.user.id, req.validated.params.id);
  try {
    await account.destroy();
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError) {
      throw ApiError.conflict('La cuenta tiene gastos registrados; archívala en lugar de eliminarla');
    }
    throw error;
  }
  return noContent(res);
}

module.exports = { list, get, create, update, archive, remove };
