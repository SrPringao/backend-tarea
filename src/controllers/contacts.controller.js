// Contactos: personas que te deben dinero (Sequelize ORM)
const ApiError = require('../utils/ApiError');
const { ok, noContent } = require('../utils/response');
const { Contact } = require('../models/orm');

// "  José  Pérez" y "jose perez" generan la misma llave y se consideran duplicados
function nameKey(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function findOwned(userId, id) {
  const contact = await Contact.findOne({ where: { id, userId } });
  if (!contact) throw ApiError.notFound('Contacto no encontrado');
  return contact;
}

async function assertNameAvailable(userId, key, exceptId) {
  const existing = await Contact.findOne({ where: { userId, nameKey: key } });
  if (existing && existing.id !== exceptId) throw ApiError.conflict(`Ya tienes un contacto llamado "${existing.name}"`);
}

async function list(req, res) {
  const where = { userId: req.user.id };
  if (!req.validated.query.includeArchived) where.archivedAt = null;
  const contacts = await Contact.findAll({ where, order: [['name', 'ASC']] });
  return ok(res, contacts);
}

async function get(req, res) {
  return ok(res, await findOwned(req.user.id, req.validated.params.id));
}

async function create(req, res) {
  const name = req.validated.body.name.replace(/\s+/g, ' ');
  const key = nameKey(name);
  await assertNameAvailable(req.user.id, key);
  const contact = await Contact.create({ userId: req.user.id, name, nameKey: key });
  return ok(res, contact, 201);
}

async function update(req, res) {
  const contact = await findOwned(req.user.id, req.validated.params.id);
  const { name, archived } = req.validated.body;
  const changes = {};

  if (name) {
    changes.name = name.replace(/\s+/g, ' ');
    changes.nameKey = nameKey(changes.name);
    await assertNameAvailable(req.user.id, changes.nameKey, contact.id);
  }
  if (archived !== undefined) changes.archivedAt = archived ? new Date() : null;

  await contact.update(changes);
  return ok(res, contact);
}

// Las entradas de patrimonio ligadas quedan sin contacto (ON DELETE SET NULL)
async function remove(req, res) {
  const contact = await findOwned(req.user.id, req.validated.params.id);
  await contact.destroy();
  return noContent(res);
}

module.exports = { list, get, create, update, remove, nameKey };
