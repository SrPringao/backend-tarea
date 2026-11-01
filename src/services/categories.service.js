// Categorías (Sequelize ORM): predeterminadas (OP-031), fusionar (OP-032) y límite mensual (OP-033)
const { QueryTypes } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { normalizeKey } = require('../utils/text');
const { currentMonth, daysInMonth } = require('../utils/dates');
const { sequelize, Category } = require('../models/orm');

const DEFAULTS = [
  { name: 'Comida', color: '#E4572E' },
  { name: 'Transporte', color: '#29335C' },
  { name: 'Hogar', color: '#8D6E63' },
  { name: 'Servicios', color: '#A8C686' },
  { name: 'Salud', color: '#669BBC' },
  { name: 'Entretenimiento', color: '#F3A712' },
  { name: 'Educación', color: '#5C6BC0' },
  { name: 'Otros', color: '#9E9E9E' },
];

async function findOwned(userId, id, label = 'Categoría') {
  const category = await Category.findOne({ where: { id, userId } });
  if (!category) throw ApiError.notFound(`${label} no encontrada`);
  return category;
}

// Crea las predeterminadas que falten (compara sin acentos ni mayúsculas); devuelve solo las nuevas
async function createDefaults(userId) {
  const existing = new Set((await Category.findAll({ where: { userId } })).map((c) => normalizeKey(c.name)));
  const missing = DEFAULTS.filter((d) => !existing.has(normalizeKey(d.name)));
  if (!missing.length) return [];
  return Category.bulkCreate(missing.map((d) => ({ ...d, userId })), { returning: true });
}

// Mueve gastos y gastos fijos de la categoría origen a la destino y elimina la origen (en una transacción)
async function merge(userId, sourceId, targetId) {
  if (sourceId === targetId) throw ApiError.badRequest('La categoría origen y la destino deben ser distintas');
  const source = await findOwned(userId, sourceId, 'Categoría origen');
  const target = await findOwned(userId, targetId, 'Categoría destino');

  const moved = await sequelize.transaction(async (transaction) => {
    const options = { replacements: { userId, sourceId, targetId }, type: QueryTypes.UPDATE, transaction };
    const [, expenses] = await sequelize.query(
      'UPDATE expenses SET category_id = :targetId WHERE user_id = :userId AND category_id = :sourceId',
      options
    );
    const [, fixed] = await sequelize.query(
      'UPDATE fixed_expenses SET category_id = :targetId WHERE user_id = :userId AND category_id = :sourceId',
      options
    );
    await source.destroy({ transaction });
    return { expenses, fixed };
  });

  return { target, movedExpenses: moved.expenses, movedFixedExpenses: moved.fixed };
}

async function setLimit(userId, categoryId, monthlyLimit) {
  const category = await findOwned(userId, categoryId);
  await category.update({ monthlyLimit });
  return category;
}

// Gastado en el mes indicado para una categoría (lo usa el campo spentThisMonth y las alertas)
async function spentInMonth(userId, categoryId, month = currentMonth()) {
  const [{ total }] = await sequelize.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS total FROM expenses
     WHERE user_id = :userId AND category_id = :categoryId AND date BETWEEN :from AND :to`,
    {
      replacements: { userId, categoryId, from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` },
      type: QueryTypes.SELECT,
    }
  );
  return total;
}

module.exports = { createDefaults, merge, setLimit, spentInMonth };
