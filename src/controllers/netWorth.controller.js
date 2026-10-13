// Patrimonio: activos y deudas (SQL nativo)
const ApiError = require('../utils/ApiError');
const { ok, noContent } = require('../utils/response');
const NetWorth = require('../models/sql/netWorth.sql');
const Ownership = require('../models/sql/ownership.sql');

async function assertRelations(userId, { accountId, contactId }) {
  if (accountId && !(await Ownership.accountIsUsable(userId, accountId))) {
    throw ApiError.badRequest('La cuenta no existe, no es tuya o está archivada', [{ field: 'accountId', message: 'Cuenta inválida' }]);
  }
  if (contactId && !(await Ownership.contactBelongs(userId, contactId))) {
    throw ApiError.badRequest('El contacto no existe o no es tuyo', [{ field: 'contactId', message: 'Contacto inválido' }]);
  }
}

// Reglas de negocio: solo las deudas tienen fecha límite y solo los activos tienen contacto (quién te debe)
function assertKindRules(entry) {
  if (entry.kind === 'asset' && entry.dueDate) {
    throw ApiError.badRequest('dueDate solo aplica a deudas (kind = debt)');
  }
  if (entry.kind === 'debt' && entry.contactId) {
    throw ApiError.badRequest('contactId solo aplica a activos (kind = asset)');
  }
}

async function list(req, res) {
  return ok(res, await NetWorth.findAll(req.user.id, req.validated.query.kind));
}

async function get(req, res) {
  const entry = await NetWorth.findById(req.user.id, req.validated.params.id);
  if (!entry) throw ApiError.notFound('Registro de patrimonio no encontrado');
  return ok(res, entry);
}

async function create(req, res) {
  const data = req.validated.body;
  assertKindRules(data);
  await assertRelations(req.user.id, data);
  return ok(res, await NetWorth.create(req.user.id, data), 201);
}

async function update(req, res) {
  const current = await NetWorth.findById(req.user.id, req.validated.params.id);
  if (!current) throw ApiError.notFound('Registro de patrimonio no encontrado');

  const data = req.validated.body;
  assertKindRules({ ...current, ...data });
  await assertRelations(req.user.id, data);
  return ok(res, await NetWorth.update(req.user.id, current.id, data));
}

async function remove(req, res) {
  const deleted = await NetWorth.remove(req.user.id, req.validated.params.id);
  if (!deleted) throw ApiError.notFound('Registro de patrimonio no encontrado');
  return noContent(res);
}

async function summary(req, res) {
  return ok(res, await NetWorth.summary(req.user.id));
}

module.exports = { list, get, create, update, remove, summary };
