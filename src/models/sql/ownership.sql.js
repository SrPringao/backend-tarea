// Verificaciones de pertenencia: evitan que un usuario relacione registros de otro usuario
const { query } = require('../../config/database');

async function exists(sql, params) {
  const { rowCount } = await query(sql, params);
  return rowCount > 0;
}

function accountIsUsable(userId, accountId) {
  return exists('SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2 AND archived_at IS NULL', [accountId, userId]);
}

function categoryBelongs(userId, categoryId) {
  return exists('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId]);
}

function contactBelongs(userId, contactId) {
  return exists('SELECT 1 FROM contacts WHERE id = $1 AND user_id = $2', [contactId, userId]);
}

module.exports = { accountIsUsable, categoryBelongs, contactBelongs };
