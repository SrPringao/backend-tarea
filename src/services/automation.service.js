// Automatización (Sequelize ORM): tokens de API personales (OP-085), mapeo de nombres de tarjeta (OP-086)
// y registro de gastos desde un webhook autenticado con token de API (OP-087).
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const { normalizeKey } = require('../utils/text');
const { ApiToken, CardNameMapping, Account, Category, User } = require('../models/orm');
const Expense = require('../models/sql/expenses.sql');
const { today } = require('../utils/dates');

const MAX_TOKENS = 10;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// ----- Tokens de API -----

// El valor completo solo se devuelve aquí; en la base queda su hash
async function createApiToken(userId, { name }) {
  const active = await ApiToken.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_TOKENS) throw ApiError.conflict(`Solo puedes tener ${MAX_TOKENS} tokens de API activos`);

  const token = `fin_${crypto.randomBytes(24).toString('base64url')}`;
  const record = await ApiToken.create({ userId, name, tokenHash: sha256(token) });
  return { token, apiToken: await ApiToken.findByPk(record.id) };
}

function listApiTokens(userId) {
  return ApiToken.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
}

async function revokeApiToken(userId, id) {
  const record = await ApiToken.findOne({ where: { id, userId } });
  if (!record) throw ApiError.notFound('Token de API no encontrado');
  if (!record.revokedAt) await record.update({ revokedAt: new Date() });
  return record;
}

async function verifyApiToken(token) {
  const record = await ApiToken.unscoped().findOne({ where: { tokenHash: sha256(String(token)), revokedAt: null } });
  if (!record) throw ApiError.unauthorized('Token de API inválido o revocado');

  const user = await User.findByPk(record.userId);
  if (!user || !user.isActive) throw ApiError.unauthorized('El usuario no existe o está desactivado');

  await record.update({ lastUsedAt: new Date() });
  return { id: user.id, role: user.role, email: user.email, apiTokenId: record.id };
}

// ----- Mapeo de nombres de tarjeta -----

async function assertAccount(userId, accountId) {
  const account = await Account.findOne({ where: { id: accountId, userId, archivedAt: null } });
  if (!account) throw ApiError.badRequest('La cuenta no existe, no es tuya o está archivada', [{ field: 'accountId', message: 'Cuenta inválida' }]);
  return account;
}

async function createCardNameMapping(userId, { cardName, accountId }) {
  await assertAccount(userId, accountId);
  const cardKey = normalizeKey(cardName);
  const existing = await CardNameMapping.findOne({ where: { userId, cardKey } });
  if (existing) throw ApiError.conflict(`Ya existe un mapeo para "${existing.cardName}"`);

  const mapping = await CardNameMapping.create({ userId, cardName, cardKey, accountId });
  return CardNameMapping.findByPk(mapping.id, { include: [{ model: Account, as: 'account' }] });
}

function listCardNameMappings(userId) {
  return CardNameMapping.findAll({
    where: { userId },
    include: [{ model: Account, as: 'account' }],
    order: [['cardName', 'ASC']],
  });
}

// ----- Webhook -----

// Resuelve la cuenta por el mapeo de tarjeta o, si no hay mapeo, por el nombre exacto de la cuenta
async function resolveAccount(userId, card) {
  const key = normalizeKey(card);
  const mapping = await CardNameMapping.findOne({ where: { userId, cardKey: key } });
  if (mapping) return assertAccount(userId, mapping.accountId);

  const accounts = await Account.findAll({ where: { userId, archivedAt: null } });
  const account = accounts.find((a) => normalizeKey(a.name) === key);
  if (!account) {
    throw ApiError.badRequest(`No hay una cuenta ni un mapeo para la tarjeta "${card}"`, [{ field: 'card', message: 'Tarjeta desconocida' }]);
  }
  return account;
}

async function webhookExpense(apiUser, { amount, card, description, date, category }) {
  const account = await resolveAccount(apiUser.id, card);

  let categoryId = null;
  if (category) {
    const categories = await Category.findAll({ where: { userId: apiUser.id } });
    categoryId = categories.find((c) => normalizeKey(c.name) === normalizeKey(category))?.id ?? null;
  }

  return Expense.create(apiUser.id, { accountId: account.id, categoryId, amount, date: date || today(), description });
}

module.exports = {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  verifyApiToken,
  createCardNameMapping,
  listCardNameMappings,
  webhookExpense,
};
