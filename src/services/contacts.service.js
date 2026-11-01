// Contactos (Sequelize ORM): fusionar contactos duplicados (OP-039)
const { QueryTypes } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { sequelize, Contact } = require('../models/orm');

async function findOwned(userId, id, label) {
  const contact = await Contact.findOne({ where: { id, userId } });
  if (!contact) throw ApiError.notFound(`${label} no encontrado`);
  return contact;
}

// Pasa los registros de patrimonio y las divisiones de gastos del origen al destino y elimina el origen.
// Si los dos contactos participan en el mismo gasto dividido, se suman los montos en una sola división.
async function merge(userId, sourceId, targetId) {
  if (sourceId === targetId) throw ApiError.badRequest('El contacto origen y el destino deben ser distintos');
  const source = await findOwned(userId, sourceId, 'Contacto origen');
  const target = await findOwned(userId, targetId, 'Contacto destino');

  const moved = await sequelize.transaction(async (transaction) => {
    const options = { replacements: { userId, sourceId, targetId }, transaction };
    await sequelize.query(
      `UPDATE expense_splits t SET amount = t.amount + s.amount
       FROM expense_splits s
       WHERE s.user_id = :userId AND s.contact_id = :sourceId AND t.contact_id = :targetId AND t.expense_id = s.expense_id`,
      options
    );
    await sequelize.query(
      `DELETE FROM expense_splits s USING expense_splits t
       WHERE s.user_id = :userId AND s.contact_id = :sourceId AND t.contact_id = :targetId AND t.expense_id = s.expense_id`,
      options
    );
    const [, splits] = await sequelize.query(
      'UPDATE expense_splits SET contact_id = :targetId WHERE user_id = :userId AND contact_id = :sourceId',
      { ...options, type: QueryTypes.UPDATE }
    );
    const [, entries] = await sequelize.query(
      'UPDATE net_worth_entries SET contact_id = :targetId WHERE user_id = :userId AND contact_id = :sourceId',
      { ...options, type: QueryTypes.UPDATE }
    );
    await source.destroy({ transaction });
    return { splits, entries };
  });

  return { target, movedNetWorthEntries: moved.entries, movedExpenseSplits: moved.splits };
}

module.exports = { merge };
