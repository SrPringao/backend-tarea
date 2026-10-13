// Categorías de gasto (Sequelize ORM)
const { Op, fn, col, where: sqlWhere } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { ok, noContent } = require('../utils/response');
const { Category } = require('../models/orm');

async function findOwned(userId, id) {
  const category = await Category.findOne({ where: { id, userId } });
  if (!category) throw ApiError.notFound('Categoría no encontrada');
  return category;
}

// Nombre único por usuario sin distinguir mayúsculas ("Comida" = "comida")
async function assertNameAvailable(userId, name, exceptId) {
  const existing = await Category.findOne({
    where: { userId, [Op.and]: [sqlWhere(fn('LOWER', col('name')), name.toLowerCase())] },
  });
  if (existing && existing.id !== exceptId) throw ApiError.conflict(`Ya tienes una categoría llamada "${existing.name}"`);
}

async function list(req, res) {
  const { search } = req.validated.query;
  const where = { userId: req.user.id };
  if (search) where.name = { [Op.iLike]: `%${search}%` };

  const categories = await Category.findAll({ where, order: [['name', 'ASC']] });
  return ok(res, categories);
}

async function get(req, res) {
  return ok(res, await findOwned(req.user.id, req.validated.params.id));
}

async function create(req, res) {
  const { name, color } = req.validated.body;
  await assertNameAvailable(req.user.id, name);
  const category = await Category.create({ userId: req.user.id, name, color });
  return ok(res, category, 201);
}

async function update(req, res) {
  const category = await findOwned(req.user.id, req.validated.params.id);
  const { name, color } = req.validated.body;
  if (name) await assertNameAvailable(req.user.id, name, category.id);
  await category.update({ name, color });
  return ok(res, category);
}

// Los gastos de la categoría quedan "Sin categoría" (ON DELETE SET NULL)
async function remove(req, res) {
  const category = await findOwned(req.user.id, req.validated.params.id);
  await category.destroy();
  return noContent(res);
}

module.exports = { list, get, create, update, remove };
