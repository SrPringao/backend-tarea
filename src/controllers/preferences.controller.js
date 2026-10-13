// Preferencias del usuario (Sequelize ORM)
const { ok } = require('../utils/response');
const { UserPreference } = require('../models/orm');

async function findOrCreate(userId) {
  const [preferences] = await UserPreference.findOrCreate({ where: { userId }, defaults: { userId } });
  return preferences;
}

async function get(req, res) {
  return ok(res, await findOrCreate(req.user.id));
}

async function update(req, res) {
  const preferences = await findOrCreate(req.user.id);
  await preferences.update(req.validated.body);
  return ok(res, preferences);
}

module.exports = { get, update };
