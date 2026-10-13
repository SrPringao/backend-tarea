// Administración de usuarios, solo rol admin (Sequelize ORM)
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { ok, noContent, pageParams, pageMeta } = require('../utils/response');
const { User } = require('../models/orm');

async function list(req, res) {
  const { search, role, isActive, ...paging } = req.validated.query;
  const { page, limit, offset } = pageParams(paging);

  const where = {};
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where[Op.or] = [{ email: { [Op.iLike]: `%${search}%` } }, { displayName: { [Op.iLike]: `%${search}%` } }];
  }

  const { rows, count } = await User.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
  return ok(res, rows, 200, pageMeta(count, page, limit));
}

async function findOr404(id) {
  const user = await User.findByPk(id);
  if (!user) throw ApiError.notFound('Usuario no encontrado');
  return user;
}

async function get(req, res) {
  return ok(res, await findOr404(req.validated.params.id));
}

async function update(req, res) {
  const { id } = req.validated.params;
  const { role, isActive, displayName } = req.validated.body;

  // Un admin no puede quitarse su propio rol ni desactivarse (evita quedarse sin administradores)
  if (id === req.user.id && (role === 'user' || isActive === false)) {
    throw ApiError.badRequest('No puedes quitarte el rol de administrador ni desactivar tu propia cuenta');
  }

  const user = await findOr404(id);
  await user.update({ role, isActive, displayName });
  return ok(res, user);
}

async function remove(req, res) {
  const { id } = req.validated.params;
  if (id === req.user.id) throw ApiError.badRequest('No puedes eliminar tu propia cuenta desde este endpoint');

  const user = await findOr404(id);
  await user.destroy();
  return noContent(res);
}

module.exports = { list, get, update, remove };
